// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AsyncLocalStorage } from 'node:async_hooks';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import * as net from 'node:net';

import express from 'express';

import { Threadlet } from '@this/async';
import { ProductInfo } from '@this/host';
import { IntfLogger } from '@this/loggy';
import { Methods, MustBe } from '@this/typey';

import { IntfHostManager } from '#x/IntfHostManager';
import { IntfRateLimiter } from '#x/IntfRateLimiter';
import { IntfRequestHandler } from '#x/IntfRequestHandler';
import { IntfRequestLogger } from '#x/IntfRequestLogger';
import { Request } from '#x/Request';
import { RequestLogHelper } from '#p/RequestLogHelper';
import { WranglerContext } from '#x/WranglerContext';


/**
 * Base class for things that "wrangle" each of the network protocols that this
 * system understands. Concrete instances of this class get instantiated once
 * per endpoint; multiple endpoints which happen to use the same protocol will
 * each use a separate instance of this class.
 *
 * Each instance manages a low-level server socket, whose connections ultimately
 * get plumbed to an (Express-like) application instance. This class is
 * responsible for constructing the application instance and getting it hooked
 * up to the rest of this class, but it does not do any configuration internally
 * to the application (which is up to the clients of this class).
 */
export class ProtocolWrangler {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /**
   * @type {?IntfLogger} Logger to use for {@link Request}s, or `null` to not do
   * any logging. This is passed into the {@link Request} constructor, which
   * will end up making a sub-logger with a generated request ID.
   */
  #requestLogger;

  /**
   * @type {?IntfHostManager} Optional host manager; only needed for some
   * protocols.
   */
  #hostManager;

  /** @type {?IntfRateLimiter} Rate limiter service to use, if any. */
  #rateLimiter;

  /** @type {IntfRequestHandler} Request handler. */
  #requestHandler;

  /**
   * @type {?RequestLogHelper} Helper for HTTP-ish request logging, or `null`
   * to not do any such logging.
   */
  #logHelper;

  /**
   * @type {AsyncLocalStorage} Per-connection storage, used to plumb connection
   * context through to the various objects that use the connection.
   */
  #perConnectionStorage = new AsyncLocalStorage();

  /** @type {string} Value to use for the `Server` HTTP-ish response header. */
  #serverHeader;

  /** @type {Threadlet} Threadlet which runs the "network stack." */
  #runner = new Threadlet(() => this.#startNetwork(), () => this.#runNetwork());

  /** @type {boolean} Has initialization been finished? */
  #initialized = false;

  /**
   * @type {boolean} Is a system reload in progress (either during start or
   * stop)?
   */
  #reloading = false;


  /**
   * Constructs an instance.
   *
   * @param {object} options Construction options.
   * @param {object} options.hostManager Host manager to use. Ignored for
   *   instances which don't do need to do host-based security (certs, etc.).
   * @param {IntfRateLimiter} options.rateLimiter Rate limiter to use. If not
   *   specified, the instance won't do rate limiting.
   * @param {IntfRequestHandler} options.requestHandler Request handler. This is
   *   required.
   * @param {IntfRequestLogger} options.requestLogger Request logger to send to.
   *   If not specified, the instance won't do request logging.
   * @param {?IntfLogger} options.logger Logger to use to emit events about what
   *   the instance is doing. If not specified, the instance won't do logging.
   * @param {string} options.protocol The name of the protocol to use.
   * @param {object} options.interface  Options to use for creation of and/or
   *   listening on the low-level server socket. See docs for
   *   `net.createServer()` and `net.Server.listen()` for details on all the
   *   available options, though with the following exceptions (done in order to
   *   harmonize with the rest of this system):
   *   * `address` is the address of the interface instead of `host`.
   *   * `*` is treated as the wildcard address, instead of `::` or `0.0.0.0`.
   *   * The default for `allowHalfOpen` is `true`, which is required in
   *     practice for HTTP2 (and is at least _useful_ in other contexts).
   */
  constructor(options) {
    const {
      hostManager,
      logger,
      rateLimiter,
      requestHandler,
      requestLogger
    } = options;

    this.#logger         = logger ?? null;
    this.#hostManager    = hostManager ?? null;
    this.#rateLimiter    = rateLimiter ?? null;
    this.#requestHandler = MustBe.object(requestHandler);
    this.#logHelper      = requestLogger ? new RequestLogHelper(requestLogger) : null;
    this.#serverHeader   = ProtocolWrangler.#makeServerHeader();

    // Confusion alert!: This is not the same as the `requestLogger` (a "request
    // logger") per se) passed in as an option. This is the sub-logger of the
    // _system_ logger, which is used for detailed logging inside `Request`.
    this.#requestLogger = logger?.req ?? null;
  }

  /**
   * Starts this instance listening for connections and dispatching them to
   * the high-level application. This method async-returns once the instance has
   * actually gotten started.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   * @throws {Error} Thrown if there was any trouble starting up.
   */
  async start(isReload) {
    this.#reloading = isReload;
    await this.#initialize();
    await this.#runner.start();
  }

  /**
   * Stops this instance from listening for any more connections. This method
   * async-returns once the instance has actually stopped. If there was an
   * error thrown while running, that error in turn gets thrown by this method.
   * If this instance wasn't running in the first place, this method does
   * nothing.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   * @throws {Error} Whatever problem occurred during running.
   */
  async stop(willReload) {
    this.#reloading = willReload;
    await this.#runner.stop();
  }

  /**
   * Initializes the instance. After this is called and (asynchronously)
   * returns, both {@link #_impl_application} and {@link #_impl_server} should
   * work without error. This can get called more than once; the second and
   * subsequent times should be considered a no-op.
   *
   * @abstract
   */
  async _impl_initialize() {
    Methods.abstract();
  }

  /**
   * Gets the (Express-like) application instance.
   *
   * @abstract
   * @returns {object} The (Express-like) application instance.
   */
  _impl_application() {
    Methods.abstract();
  }

  /**
   * Performs starting actions specifically in service of the high-level
   * protocol (e.g. HTTP2) and (Express-like) application that layers on top of
   * it, in advance of it being handed connections. This should only
   * async-return once the stack really is ready.
   *
   * @abstract
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async _impl_applicationStart(isReload) {
    Methods.abstract(isReload);
  }

  /**
   * Performs stop/shutdown actions specifically in service of the high-level
   * protocol (e.g. HTTP2) and (Express-like) application that layers on top of
   * it, after it is no longer being handed connections. This should only
   * async-return once the stack really is stopped.
   *
   * @abstract
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async _impl_applicationStop(willReload) {
    Methods.abstract(willReload);
  }

  /**
   * Gets an object with bindings for reasonably-useful for logging about this
   * instance, particularly the low-level socket state.
   *
   * @abstract
   * @returns {object} Object with interesting stuff about the server socket.
   */
  _impl_loggableInfo() {
    Methods.abstract();
  }

  /**
   * Gets the (`HttpServer`-like) protocol server instance.
   *
   * @abstract
   * @returns {object} The (`HttpServer`-like) protocol server instance.
   */
  _impl_server() {
    Methods.abstract();
  }

  /**
   * Starts the server socket, that is, gets it listening for connections. This
   * should only async-return once the socket is really listening.
   *
   * @abstract
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async _impl_serverSocketStart(isReload) {
    Methods.abstract(isReload);
  }

  /**
   * Stops the server socket, that is, closes it and makes it stop listening.
   * This should only async-return once the socket is truly stopped / closed.
   *
   * @abstract
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async _impl_serverSocketStop(willReload) {
    Methods.abstract(willReload);
  }

  /** @returns {?IntfHostManager} The host manager, if any. */
  get _prot_hostManager() {
    return this.#hostManager;
  }

  /**
   * Informs the higher-level stack of a connection received by the lower-level
   * stack. This "protected" method is expected to be called by subclass code.
   *
   * @param {net.Socket} socket Socket representing the newly-made connection.
   * @param {?IntfLogger} logger Logger to use for the connection, if any.
   */
  _prot_newConnection(socket, logger) {
    // What's going on here:
    //
    // The layers of protocol implementation inside Node "conspire" to hide the
    // original socket of the `connection` event from the request and response
    // objects that ultimately get emitted as part of a `request` event, but we
    // want to actually be able to track a request back to the connection. This
    // is used for logging in two ways: (a) to map a request ID to a connection
    // ID, and (b) to get the remote address of a connection. On that last part,
    // Node makes some effort to expose "safe" socket operations through all the
    // wrapped layers, but at least in our use case (maybe because we ourselves
    // wrap the raw socket, and that messes with an `instanceof` check in the
    // guts of Node's networking code) the punch-through doesn't actually work.
    //
    // Thankfully, Node has an "async local storage" mechanism which is geared
    // towards exactly this sort of use case. By emitting the `connection` event
    // with our connection context as the designated "async storage," handlers
    // for downstream events can retrieve that same context. Instead of exposing
    // this async storage stuff more widely, we use it _just_ in this class to
    // attach the connection info (via a `WeakMap`) to all the downstream
    // objects that our event handlers might eventually find themselves with.
    // The API for this (to the rest of the system) is the class
    // `WranglerContext`.

    const connectionCtx = WranglerContext.forConnection(socket, logger);

    WranglerContext.bind(socket, connectionCtx);

    this.#perConnectionStorage.run(connectionCtx, () => {
      this._impl_server().emit('connection', socket);
    });

    // Note: The code responsible for handing us the connection also does
    // logging for it, so there's no need for additional connection logging
    // here.
  }

  /**
   * Informs the higher-level stack of session creation from the lower-level
   * stack. This "protected" method is expected to be called by subclass code.
   * (Note: As of this writing, this is only useful to be called from HTTP2
   * wrangling code.)
   *
   * @param {object} session The (`http2.Http2Session`-like) instance.
   * @returns {WranglerContext} Context associated with this session.
   */
  _prot_newSession(session) {
    // Propagate the connection context. See `_prot_newConnection()` for a
    // treatise about what's going on.

    const ctx = this.#perConnectionStorage.getStore();

    if (!ctx) {
      // Shouldn't happen.
      this.#logger?.missingContext('session');
      throw new Error('Shouldn\'t happen: Missing context during session setup.');
    }

    const sessionLogger = this.#logger?.sess.$newId;
    const sessionCtx    = WranglerContext.forSession(ctx, sessionLogger);

    WranglerContext.bind(session, sessionCtx);
    WranglerContext.bind(session.socket, sessionCtx);

    ctx.connectionLogger?.newSession(sessionCtx.sessionId);

    if (sessionLogger) {
      sessionLogger.opened({
        connectionId: ctx.connectionId ?? '<unknown-id>'
      });

      session.once('close',      () => sessionLogger.closed('ok'));
      session.on(  'error',      (e) => sessionLogger.closed('error', e));
      session.once('goaway',     (code) => sessionLogger.closed('goaway', code));
      session.once('frameError', (type, code, id) =>
        sessionLogger.closed('frameError', type, code, id));
    }

    return sessionCtx;
  }

  /**
   * Handles an error encountered during Express dispatch. Parameters are as
   * defined by the Express middleware spec.
   *
   * @param {Error} err The error.
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {function(?*)} next_unused Next-middleware function. Unused, but
   *   required to be declared so that Express knows that this is an
   *   error-handling function.
   */
  #handleError(err, req, res, next_unused) {
    const logger = WranglerContext.get(req)?.logger;

    logger?.topLevelError(err);
    res.sendStatus(500);
    res.end();
  }

  /**
   * "First licks" request handler during Express dispatch. This gets added as
   * the first middlware handler to the high-level application. Parameters are
   * as defined by the Express middleware spec. This method will call out to the
   * configured `requestHandler` when appropriate (e.g. not rate-limited, etc.).
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {function(?*)} next Function which causes the next-bound middleware
   *   to run.
   */
  async #handleExpressRequest(req, res, next) {
    const context   = WranglerContext.getNonNull(req.socket, req.stream?.session);
    const request   = new Request(context, req, res, this.#requestLogger);
    const reqLogger = request.logger;

    const reqCtx = WranglerContext.forRequest(context, request);
    WranglerContext.bind(req, reqCtx);

    this.#logHelper?.logRequest(request, context);

    res.set('Server', this.#serverHeader);

    if (!request.pathnameString) {
      // It's not an `origin` request. We don't handle any other type of
      // target... yet.
      await request.sendError(400); // "Bad Request."
      return;
    } else if (this.#rateLimiter) {
      const granted = await this.#rateLimiter.newRequest(reqLogger);
      if (!granted) {
        // Send the error response, and wait for it to be (believed to be) sent.
        await request.sendError(503); // "Service Unavailable."

        // ...and then just thwack the underlying socket. The hope is that the
        // waiting above will make it likely that the far side will actually see
        // the 503 response.
        const csock = context.socket;
        csock.end();
        csock.once('finish', () => {
          csock.destroy();
        });

        return;
      }
    }

    try {
      const result = await this.#requestHandler.handleRequest(request, null);

      if (result) {
        // Validate that the request was actually handled.
        if (!res.writableEnded) {
          reqLogger?.responseNotActuallyHandled();
          // Gets caught immediately below.
          throw new Error('Response returned "successfully" without completing.');
        }
      } else {
        next();
      }
    } catch (e) {
      next(e);
    }
  }

  /**
   * Handles a request as received directly from the HTTP-ish server object.
   * Note that the parameters here are regular `http.*` or `http2.*` objects and
   * not Express wrappers.
   *
   * @param {Http2ServerRequest|IncomingMessage} req Request object.
   * @param {Http2ServerResponse|ServerResponse} res Response object.
   */
  #incomingRequest(req, res) {
    const url     = req.url;
    let   logger  = this.#logger;

    const context = WranglerContext.get(req.socket, req.stream?.session);

    if (context === null) {
      // Shouldn't happen: We have no record of the socket.
      logger?.incomingRequest(url, {});
      logger?.apparentlyLostSocket(url);
      req.socket?.destroy();
      if (res.socket !== req.socket) {
        res.socket?.destroy();
      }
      return;
    }

    logger = context.logger ?? logger;

    try {
      logger?.incomingRequest(url, context.ids);

      const application = this._impl_application();
      application(req, res);
    } catch (e) {
      // Note: This is theorized to occur in practice when the socket for a
      // request gets closed after the request was received but before it
      // managed to get dispatched.
      logger?.errorDuringIncomingRequest(url, e);
      const socket = req.socket;
      const socketState = {
        closed:        socket.closed,
        destroyed:     socket.destroyed,
        readable:      socket.readable,
        readableEnded: socket.readableEnded,
        writableEnded: socket.writableEnded
      };
      logger?.socketState(url, socketState);
    }
  }

  /**
   * Finishes initialization of the instance, by setting up all the event and
   * route handlers on the protocol server and high-level application instance.
   * We can't do this in the constructor, because at the time this (base class)
   * constructor runs, the concrete class constructor hasn't finished, and it's
   * only after it's finished that we can grab the objects that it's responsible
   * for creating.
   */
  async #initialize() {
    if (this.#initialized) {
      return;
    }

    await this._impl_initialize();

    const application = this._impl_application();
    const server      = this._impl_server();

    // Configure the top-level application properties.

    // This means paths `/foo` and `/Foo` are different.
    application.set('case sensitive routing', true);

    // A/O/T `development`. Note: Per Express docs, this makes error messages be
    // "less verbose," so it may be reasonable to turn it off when debugging
    // things like Express routing weirdness etc. Or, maybe this project's needs
    // are so modest that it's better to just leave it in `development` mode
    // permanently.
    application.set('env', 'production');

    // Don't generate etags automatically. Particular apps -- e.g., notably
    // `StaticFiles`, might still choose to generate them, though.
    application.set('etag fn', false);

    // This means paths `/foo` and `/foo/` are different.
    application.set('strict routing', true);

    // Do not strip off any parts from the parsed hostname.
    application.set('subdomain offset', 0);

    // This squelches the response header advertisement for Express.
    application.set('x-powered-by', false);

    // Set up high-level application routing, including getting the protocol
    // server to hand requests off to the application.
    //
    // Note: Express uses the function argument shape (count of arguments) to
    // determine behavior, so we can't just use `(...args)` for those.

    application.use('/', (req, res, next) => this.#handleExpressRequest(req, res, next));
    application.use('/', (err, req, res, next) => this.#handleError(err, req, res, next));
    server.on('request', (...args) => this.#incomingRequest(...args));

    // Set up an event handler to propagate the connection context. See
    // `_prot_newConnection()` for a treatise about what's going on.

    server.on('secureConnection', (socket) => {
      const ctx = this.#perConnectionStorage.getStore();
      if (ctx) {
        WranglerContext.bind(socket, ctx);
      } else {
        this.#logger?.missingContext('secureConnection');
      }
    });

    // Done!

    this.#initialized = true;
  }

  /**
   * Runs the "network stack." This is called as the main function of the
   * {@link #runner}.
   */
  async #runNetwork() {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down. (This would change in the
    // future if we switched to using async-events instead of Node callbacks at
    // this layer.)

    await this.#runner.whenStopRequested();

    if (this.#logger) {
      this.#logger.stopping(this._impl_loggableInfo());
    }

    // We do these in parallel, because there can be mutual dependencies, e.g.
    // the application might need to see the server stopping _and_ vice versa.
    await Promise.all([
      this._impl_serverSocketStop(this.#reloading),
      this._impl_applicationStop(this.#reloading)
    ]);

    if (this.#logger) {
      this.#logger.stopped(this._impl_loggableInfo());
    }
  }

  /**
   * Starts the "network stack." This is called as the start function of the
   * {@link #runner}.
   */
  async #startNetwork() {
    if (this.#logger) {
      this.#logger.starting(this._impl_loggableInfo());
    }

    await this._impl_applicationStart(this.#reloading);
    await this._impl_serverSocketStart(this.#reloading);

    if (this.#logger) {
      this.#logger.started(this._impl_loggableInfo());
    }
  }


  //
  // Static members
  //

  /**
   * Makes the value to store in {@link #serverHeader}.
   *
   * @returns {string} The value in question.
   */
  static #makeServerHeader() {
    const pi = ProductInfo;

    return `${pi.name}-${pi.version} ${pi.commit}`;
  }
}
