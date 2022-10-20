// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { AsyncLocalStorage } from 'node:async_hooks';
import * as net from 'node:net';

import express from 'express';

import { BaseService } from '@this/app-services';
import { Threadlet } from '@this/async';
import { Methods } from '@this/typey';

import { RequestLogger } from '#p/RequestLogger';
import { WranglerContext } from '#x/WranglerContext';


/**
 * Base class for things that "wrangle" each of the server protocols that this
 * system understands. Concrete instances of this class get instantiated once
 * per server; multiple servers which happen to use the same protocol will each
 * use a separate instance of this class.
 *
 * Each instance manages a low-level server socket, whose connections ultimately
 * get plumbed to an (Express-like) application instance. This class is
 * responsible for constructing the application instance and getting it hooked
 * up to the rest of this class, but it does not do any configuration internally
 * to the application (which is up to the clients of this class).
 */
export class ProtocolWrangler {
  /** @type {?function(...*)} Logger, if logging is to be done. */
  #logger;

  /** @type {?BaseService} Rate limiter service to use, if any. */
  #rateLimiter;

  /**
   * @type {?RequestLogger} HTTP(ish) request logger, if logging is to be done.
   */
  #requestLogger;

  /**
   * @type {AsyncLocalStorage} Per-connection storage, used to plumb connection
   * context through to the various objects that use the connection.
   */
  #perConnectionStorage = new AsyncLocalStorage();

  /** @type {Threadlet} Threadlet which runs the "network stack." */
  #runner = new Threadlet(() => this.#startNetwork(), () => this.#runNetwork());

  /** @type {boolean} Has initialization been finished? */
  #initialized = false;


  /**
   * Constructs an instance. Accepted options:
   *
   * * `hosts: object` -- Value returned from {@link
   *   HostManager.secureServerOptions}, if this instance is (possibly) expected
   *   to need to use certificates (etc.). Ignored for instances which don't do
   *   that sort of thing.
   * * `rateLimiter: BaseService` -- Rate limiter to use. (If not specified, the
   *   instance won't do rate limiting.)
   * * `requestLogger: BaseService` -- Request logger to send to. (If not
   *   specified, the instance won't do request logging.)
   * * `logger: function(...*)` -- Logger to use to emit events about what the
   *   instance is doing. (If not specified, the instance won't do logging.)
   * * `protocol: string` -- The name of this protocol.
   * * `socket: object` -- Options to use for creation of and/or listening on
   *   the low-level server socket. See docs for `net.createServer()` and
   *   `net.Server.listen()` for more details. Exception: `*` is treated as the
   *   wildcard name for the `host` interface.
   *
   * @param {object} options Construction options, per the description above.
   */
  constructor(options) {
    const { logger, rateLimiter, requestLogger } = options;

    this.#logger        = logger ?? null;
    this.#rateLimiter   = rateLimiter ?? null;
    this.#requestLogger = requestLogger
      ? new RequestLogger(requestLogger, logger)
      : null;
  }

  /**
   * @returns {object} The high-level application instance. This is an instance
   * of `express:Express` or thing that is (approximately) compatible with same.
   */
  get application() {
    this.#initialize();
    return this._impl_application();
  }

  /**
   * Starts this instance listening for connections and dispatching them to
   * the high-level application. This method async-returns once the instance has
   * actually gotten started.
   *
   * @throws {Error} Thrown if there was any trouble starting up.
   */
  async start() {
    this.#initialize();
    return this.#runner.start();
  }

  /**
   * Stops this instance from listening for any more connections. This method
   * async-returns once the instance has actually stopped. If there was an
   * error thrown while running, that error in turn gets thrown by this method.
   * If this instance wasn't running in the first place, this method does
   * nothing.
   *
   * @throws {Error} Whatever problem occurred during running.
   */
  async stop() {
    return this.#runner.stop();
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
   */
  async _impl_applicationStart() {
    Methods.abstract();
  }

  /**
   * Performs stop/shutdown actions specifically in service of the high-level
   * protocol (e.g. HTTP2) and (Express-like) application that layers on top of
   * it, after it is no longer being handed connections. This should only
   * async-return once the stack really is stopped.
   *
   * @abstract
   */
  async _impl_applicationStop() {
    Methods.abstract();
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
   */
  async _impl_serverSocketStart() {
    Methods.abstract();
  }

  /**
   * Stops the server socket, that is, closes it and makes it stop listening.
   * This should only async-return once the socket is truly stopped / closed.
   *
   * @abstract
   */
  async _impl_serverSocketStop() {
    Methods.abstract();
  }

  /**
   * Informs the higher-level stack of a connection received by the lower-level
   * stack. This "protected" method is expected to be called by subclass code.
   *
   * @abstract
   * @param {net.Socket} socket Socket representing the newly-made connection.
   * @param {?function(...*)} logger Logger to use for the connection, if any.
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
    // The API for this (to the rest of the module) is the class
    // `WranglerContext`.

    const connectionCtx = WranglerContext.forConnection(socket, logger);

    WranglerContext.bind(socket, connectionCtx);

    this.#perConnectionStorage.run(connectionCtx, () => {
      this._impl_server().emit('connection', socket);
    });
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
   * "First licks" request handler. This gets added as the first middlware
   * handler to the high-level application. Parameters are as defined by the
   * Express middleware spec.
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {function(?*)} next Function which causes the next-bound middleware
   *   to run.
   */
  async #handleRequest(req, res, next) {
    const connectionCtx = WranglerContext.get(req.socket, req.stream?.session);
    let   reqLogger     = null;

    if (this.#requestLogger) {
      const connectionId  = connectionCtx?.connectionId ?? null;
      reqLogger = this.#requestLogger.logRequest(req, res, connectionCtx);
    }

    const reqCtx = WranglerContext.forRequest(connectionCtx, reqLogger);
    WranglerContext.bind(req, reqCtx);
    WranglerContext.bind(req, reqCtx);

    if (this.#rateLimiter) {
      const granted = await this.#rateLimiter.newRequest(reqLogger);
      if (!granted) {
        res.sendStatus(503);
        res.end();

        // Wait for the response to have been at least nominally sent before
        // closing the socket, in the hope that there is a good chance that it
        // will allow for the far side to see the 503 response. Note: The
        // `ServerResponse` object nulls out the socket after `end()` completes,
        // which is why we grab it outside the `finish` callback.
        const resSocket = res.socket;
        res.once('finish', () => { resSocket.end();     });
        res.once('end',    () => { resSocket.destroy(); });

        return;
      }
    }

    next();
  }

  /**
   * Finish initialization of the instance, by setting up all the event and
   * route handlers on the protocol server and high-level application instance.
   * We can't do this in the constructor, because at the time this (base class)
   * constructor runs, the concrete class constructor hasn't finished, and it's
   * only after it's finished that we can grab the objects that it's responsible
   * for creating.
   */
  #initialize() {
    if (this.#initialized) {
      return;
    }

    const app    = this._impl_application();
    const server = this._impl_server();

    // Set up high-level application routing, including getting the protocol
    // server to hand requests off to the app.

    app.use('/', (req, res, next)      => { this.#handleRequest(req, res, next);    });
    app.use('/', (err, req, res, next) => { this.#handleError(err, req, res, next); });

    server.on('request', app);

    // Set up event handlers to propagate the connection context. See
    // `_prot_newConnection()` for a treatise about what's going on.

    server.on('secureConnection', (socket) => {
      const ctx = this.#perConnectionStorage.getStore();
      if (ctx) {
        WranglerContext.bind(socket, ctx);
      } else {
        this.#logger?.missingContext('secureConnection');
      }
    });

    server.on('session', (session) => {
      const ctx = this.#perConnectionStorage.getStore();
      if (ctx) {
        WranglerContext.bind(session, ctx);
        WranglerContext.bind(session.socket, ctx);
      } else {
        this.#logger?.missingContext('session');
      }
    });

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
      this._impl_serverSocketStop(),
      this._impl_applicationStop()
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

    await this._impl_applicationStart();
    await this._impl_serverSocketStart();

    if (this.#logger) {
      this.#logger.started(this._impl_loggableInfo());
    }
  }
}
