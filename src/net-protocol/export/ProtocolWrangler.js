// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { inspect } from 'node:util';

import { Threadlet } from '@this/async';
import { ProductInfo } from '@this/host';
import { IntfLogger } from '@this/loggy-intf';
import { FullResponse, IncomingRequest, IntfRequestHandler, RequestContext,
  StatusResponse, TypeNodeRequest, TypeNodeResponse }
  from '@this/net-util';
import { Methods, MustBe } from '@this/typey';

import { IntfAccessLog } from '#x/IntfAccessLog';
import { IntfConnectionRateLimiter } from '#x/IntfConnectionRateLimiter';
import { IntfDataRateLimiter } from '#x/IntfDataRateLimiter';
import { IntfHostManager } from '#x/IntfHostManager';
import { WranglerContext } from '#p/WranglerContext';


/**
 * Base class for things that "wrangle" each of the network protocols that this
 * system understands. Concrete instances of this class get instantiated once
 * per endpoint; multiple endpoints which happen to use the same protocol will
 * each use a separate instance of this class.
 *
 * Each instance manages a low-level server socket, whose connections ultimately
 * get plumbed to an external (to this class) request handler, typically via a
 * built-in Node `http*` server class. _This_ class is responsible for managing
 * the server socket lifetime, plumbing requests through to its client, and
 * providing simple default handling when the client fails to handle requests
 * (or errors out while trying).
 */
export class ProtocolWrangler {
  /**
   * System logger to use, or `null` to not do any logging.
   *
   * @type {?IntfLogger}
   */
  #logger = null;

  /**
   * Logger to use for {@link IncomingRequest}s, or `null` to not do any
   * logging. This is passed into the {@link IncomingRequest} constructor, which
   * will end up making a sub-logger with a generated request ID.
   *
   * @type {?IntfLogger}
   */
  #requestLogger = null;

  /**
   * Service which logs network access (requests and responses), or `null` to
   * not do any such logging. **Note:** This is for "access log" style logging,
   * as opposed to {@link #requestLogger}, which does system logging for
   * requests.
   *
   * @type {?IntfAccessLog}
   */
  #accessLog;

  /**
   * Optional host manager; only needed for some protocols.
   *
   * @type {?IntfHostManager}
   */
  #hostManager;

  /**
   * Request handler.
   *
   * @type {IntfRequestHandler}
   */
  #requestHandler;

  /**
   * Return value for {@link #interface}.
   *
   * @type {object}
   */
  #interfaceObject;

  /**
   * Maximum request body allowed, in bytes, or `null` if there is no limit.
   *
   * @type {?number}
   */
  #maxRequestBodyBytes;

  /**
   * Value to use for the `Server` HTTP-ish response header.
   *
   * @type {string}
   */
  #serverHeader;

  /**
   * Threadlet which runs the "network stack."
   *
   * @type {Threadlet}
   */
  #runner = new Threadlet(() => this.#startNetwork(), (ra) => this.#runNetwork(ra));

  /**
   * Are we stopping (or stopped)?
   *
   * @type {boolean}
   */
  #stopping = true;

  /**
   * Is the system about to reload (after stopping)?
   *
   * @type {boolean}
   */
  #willReload = false;

  /**
   * Constructs an instance.
   *
   * @param {object} options Construction options.
   * @param {IntfAccessLog} options.accessLog Network access logger to send to.
   *   If not specified, the instance won't do access logging.
   * @param {IntfConnectionRateLimiter} options.connectionRateLimiter Rate
   *   limiter to use for connections. If not specified, the instance won't do
   *   connection rate limiting.
   * @param {IntfDataRateLimiter} options.dataRateLimiter Data rate limiter to
   *   use. If not specified, the instance won't do data rate limiting.
   * @param {object} options.hostManager Host manager to use. Ignored for
   *   instances which don't do need to do host-based security (certs, etc.).
   * @param {object} options.interface Options to use for creation of and/or
   *   listening on the low-level server socket. See docs for
   *   `net.createServer()` and `net.Server.listen()` for details on all the
   *   available options, though with the following exceptions (done in order to
   *   harmonize with the rest of this system):
   *   * `address` is the address of the interface instead of `host`.
   *   * `*` is treated as the wildcard address, instead of `::` or `0.0.0.0`.
   *   * The default for `allowHalfOpen` is `true`, which is required in
   *     practice for HTTP2 (and is at least _useful_ in other contexts).
   * @param {?number} [options.maxRequestBodyBytes] Maximum size allowed for a
   *   request body, in bytes, or `null` not to have a limit. Note that not
   *   having a limit is often ill-advised. If non-`null`, must be a positive
   *   integer.
   * @param {string} options.protocol The name of the protocol to use.
   * @param {IntfRequestHandler} options.requestHandler Request handler. This is
   *   required.
   */
  constructor(options) {
    // Note: See `TcpWrangler` for where `connectionRateLimiter` and
    // `dataRateLimiter` are used. See `ProtocolWranglers` (plural) for where
    // `protocol` is used.

    const {
      accessLog,
      hostManager,
      interface: interfaceConfig,
      maxRequestBodyBytes = null,
      requestHandler
    } = options;

    this.#accessLog      = accessLog ?? null;
    this.#hostManager    = hostManager ?? null;
    this.#requestHandler = MustBe.object(requestHandler);
    this.#serverHeader   = ProtocolWrangler.#makeServerHeader();

    this.#interfaceObject = Object.freeze({
      address: interfaceConfig.address ?? null,
      fd:      interfaceConfig.fd      ?? null,
      port:    interfaceConfig.port    ?? null
    });

    this.#maxRequestBodyBytes = (maxRequestBodyBytes === null)
      ? null
      : MustBe.number(maxRequestBodyBytes, { safeInteger: true, minInclusive: 1 });
  }

  /**
   * @returns {{ address: ?string, port: ?number, fd: ?number }} The IP address
   * and port of the interface, _or_ the file descriptor, which this instance
   * listens on. In the case of a file descriptor, `port` might be defined, in
   * which case it is the "declared port" to report to clients, e.g. for
   * logging.
   */
  get interface() {
    return this.#interfaceObject;
  }

  /** @returns {?IntfLogger} The logger for this instance. */
  get logger() {
    return this.#logger;
  }

  /**
   * Initializes this instance as needed prior to getting `start()`ed, including
   * optionally setting up a logger to use.
   *
   * @param {?IntfLogger} logger System logger to use, or `null` if to not do
   *   logging.
   */
  async init(logger) {
    this.#logger = logger;

    // Confusion alert!: This is not the same as the `requestLogger` (a "request
    // logger") per se) passed in as an option. This is the sub-logger of the
    // _system_ logger, which is used for detailed logging inside
    // `IncomingRequest`.
    this.#requestLogger = logger?.req ?? null;

    await this._impl_init();
  }

  /**
   * Starts this instance listening for connections and dispatching them to the
   * high-level application. This method async-returns once the instance has
   * actually gotten started.
   *
   * @throws {Error} Thrown if there was any trouble starting up.
   */
  async start() {
    this.#stopping = false;
    await this.#runner.start();
  }

  /**
   * Stops this instance from listening for any more connections. This method
   * async-returns once the instance has actually stopped. If there was an error
   * thrown while running, that error in turn gets thrown by this method. If
   * this instance wasn't running in the first place, this method does nothing.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   * @throws {Error} Whatever problem occurred during running.
   */
  async stop(willReload) {
    this.#willReload = willReload;
    this.#stopping   = true;
    await this.#runner.stop();
  }

  /**
   * @abstract
   * @returns {object} A plain object with properties containing reasonably info
   *   about this instance, suitable for logging, particularly the low-level
   *   socket state.
   */
  get _impl_infoForLog() {
    return Methods.abstract();
  }

  /**
   * Initializes the instance.
   *
   * @abstract
   */
  async _impl_init() {
    Methods.abstract();
  }

  /**
   * Performs starting actions specifically in service of the high-level
   * protocol (e.g. HTTP2), in advance of it being handed connections. This
   * should only async-return once the stack really is ready.
   *
   * @abstract
   */
  async _impl_serverStart() {
    Methods.abstract();
  }

  /**
   * Performs stop/shutdown actions specifically in service of the high-level
   * protocol (e.g. HTTP2), after it is no longer being handed connections. This
   * should only async-return once the stack really is stopped.
   *
   * @abstract
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async _impl_serverStop(willReload) {
    Methods.abstract(willReload);
  }

  /**
   * Starts the server socket, that is, gets it listening for connections. This
   * should only async-return once the socket is really listening.
   *
   * @abstract
   */
  async _impl_socketStart() {
    Methods.abstract();
  }

  /**
   * Stops the server socket, that is, closes it and makes it stop listening.
   * This should only async-return once the socket is truly stopped / closed.
   *
   * @abstract
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async _impl_socketStop(willReload) {
    Methods.abstract(willReload);
  }

  /** @returns {?IntfHostManager} The host manager, if any. */
  get _prot_hostManager() {
    return this.#hostManager;
  }

  /**
   * Asks the base class to handle a request as received directly from the
   * protocol server object. This method should be called by the concrete
   * subclass in response to receiving a request.
   *
   * **Note:** It is expected that this method is called in a context where any
   * error becomes uncaught. As such, this method aims never to `throw`, instead
   * logging errors and reporting error-ish statuses to the (remote) client.
   *
   * @param {TypeNodeRequest} req Request object.
   * @param {TypeNodeResponse} res Response object.
   */
  async _prot_incomingRequest(req, res) {
    // This method performs everything that can be done synchronously as the
    // event callback that this is, and then (assuming all's well) hands things
    // off to our main `async` request handler.

    const { socket, stream, url } = req;
    const context                 = WranglerContext.get(socket, stream?.session);
    const logger                  = context?.logger ?? this.#logger;

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

    const requestContext = new RequestContext(this.interface, context.remoteInfo);
    let   request        = null;

    // Responds to a problematic request with an error status of some sort,
    // closes the request, and logs a bit of info which might help elucidate the
    // situation.
    const errorResponse = (e, status, message = e.message) => {
      logger?.errorDuringIncomingRequest({
        ...context.ids,
        requestId: request?.id ?? '<unknown>',
        url:       request?.urlForLog ?? url,
        socketState: {
          closed:        socket.closed,
          destroyed:     socket.destroyed,
          readable:      socket.readable,
          readableEnded: socket.readableEnded,
          writableEnded: socket.writableEnded
        },
        error: e
      });

      res.statusCode = status;

      res.setHeader('Content-Type', 'text/plain');
      res.write(message);
      if (!message.endsWith('\n')) {
        res.write('\n');
      }

      res.end();
    };

    try {
      request = await IncomingRequest.fromNodeRequest(req, requestContext,
        {
          logger:              this.#requestLogger,
          maxRequestBodyBytes: this.#maxRequestBodyBytes
        });
    } catch (e) {
      // This generally means there was something malformed about the request,
      // so we nip things in the bud here, responding with a 400 status ("Bad
      // Request").
      errorResponse(e, 400);
      return;
    }

    try {
      logger?.incomingRequest({
        ...context.ids,
        requestId: request.id,
        url:       request.urlForLog
      });

      if (this.#accessLog) {
        this.#logAndRespondToRequest(request, context, res);
      } else {
        this.#respondToRequest(request, context, res);
      }
    } catch (e) {
      // This probably indicates a bug in this project. That is, our goal is for
      // this not to be possible. That said, as of this writing, this is
      // theorized to occur in practice when the socket for a request gets
      // closed after the request was received but before it managed to get
      // dispatched.
      errorResponse(e, 500, 'Internal Server Error');
    }
  }

  /**
   * Is this instance trying to stop (or has it already stopped)? This is meant
   * for subclasses to call when figuring out whether or not to allow new
   * connections, requests, etc.
   *
   * @returns {boolean} `true` if the instance is stopping or stopped, or
   *   `false` if it is running.
   */
  _prot_isStopping() {
    return this.#stopping;
  }

  /**
   * Top-level of the asynchronous request handling flow. This method will call
   * out to the configured `requestHandler` when appropriate (e.g. not
   * rate-limited, etc.).
   *
   * **Note:** There is nothing set up to catch errors thrown by this method. It
   * is not supposed to `throw` (directly or indirectly).
   *
   * @param {IncomingRequest} request Request object.
   * @returns {FullResponse} The response to send.
   */
  async #handleRequest(request) {
    if (!request.pathnameString) {
      // It's not an `origin` request. We don't handle any other type of
      // target... yet.
      //
      // Handy command for testing this code path:
      // ```
      // echo $'GET * HTTP/1.1\r\nHost: milk.com\r\n\r' \
      //   | curl telnet://localhost:8080
      // ```
      return FullResponse.makeMetaResponse(400); // "Bad Request."
    }

    const result = await this.#requestHandler.handleRequest(request, null);

    if (result instanceof FullResponse) {
      return result;
    } else if (result instanceof StatusResponse) {
      return result.responseFor(request);
    } else if (result === null) {
      // The configured `requestHandler` didn't actually handle the request.
      // Respond with a simple "not found". (If the client wants something
      // fancier, they can do it themselves.)
      return StatusResponse.NOT_FOUND.responseFor(request);
    } else {
      // The error thrown here is caught by our direct caller,
      // `#respondToRequest()`.
      const type      = typeof result;
      const inspected = inspect(result);
      throw new Error(
        `Strange result (type \`${type}\` from \`handleRequest\`:\n${inspected}\n`);
    }
  }

  /**
   * Top-level of the asynchronous request handling flow. When appropriate, this
   * in turn calls to our response-creator, which is supposed to always return
   * _something_ to use as a response. This method also handles request logging.
   *
   * **Note:** There is nothing set up to catch errors thrown by this method. It
   * is not supposed to `throw` (directly or indirectly).
   *
   * @param {IncomingRequest} request Request object.
   * @param {WranglerContext} outerContext The outer context of `request`.
   * @param {TypeNodeResponse} res Low-level response object.
   * @returns {FullResponse} The response object that was ultimately sent (or
   *   was at least ulitmately attempted to be sent).
   */
  async #respondToRequest(request, outerContext, res) {
    const reqLogger = request.logger;

    let result = null;

    try {
      result ??= await this.#handleRequest(request, outerContext);
    } catch (e) {
      // `500` == "Internal Server Error."
      const bodyExtra = e.stack ?? e.message ?? '<unknown>';
      result = FullResponse.makeMetaResponse(500, { bodyExtra });
    }

    try {
      res.setHeader('Server', this.#serverHeader);

      await result.writeTo(res);
    } catch (e) {
      // This can happen when the connection gets closed from the other side
      // when in the middle of responding, in which case the error is ignorable
      // here, as it'll show up as a connection error when logging the request.
      // But other errors -- which probably shouldn't ever happen -- are worth
      // logging, as possible bugs in this project.
      //
      // In any case, we probably can't actually let the remote side know about
      // the problem in any _good_ way, since the call to `respond()` probably
      // already started the response, or the connection is already closed. So
      // we do what little we can that might help, and then just close the
      // socket (if it isn't already), and hope for the best.
      if (e.code !== 'ECONNRESET') {
        reqLogger?.errorWhileWritingResponse(e);
      }

      res.statusCode = 500; // "Internal Server Error."
      res.end();
    }

    if ((res.statusCode >= 500) || (res.statusCode === 429)) {
      // It's a "server error" (5xx) or "too many requests" (429) error, so it's
      // appropriate to completely close the connection.
      const csock = outerContext.socket;
      csock.end();
      csock.once('finish', () => {
        csock.destroy();
      });
    }

    return result;
  }

  /**
   * Wrapper around {@link #respondToRequest}, which is used when {link
   * #accessLog} is non-`null`.
   *
   * **Note:** There is nothing set up to catch errors thrown by this method. It
   * is not supposed to `throw` (directly or indirectly).
   *
   * @param {IncomingRequest} request Request object.
   * @param {WranglerContext} outerContext The outer context of `request`.
   * @param {TypeNodeResponse} res Low-level response object.
   * @returns {FullResponse} The response object that was ultimately sent (or
   *   was at least ulitmately attempted to be sent).
   */
  async #logAndRespondToRequest(request, outerContext, res) {
    const accessLog = this.#accessLog;

    // We send `requestStarted` and wait for it to return before proceeding with
    // any actual response work. Sending this event has to be done as early as
    // reasonably possible during request dispatch so that timing measurements
    // will be maximally accurate. And in fact, this method (right here) gets
    // called at about as good a spot as can be managed.

    try {
      await accessLog.send('requestStarted', request);
    } catch (e) {
      // Log it and move on rather than letting the system crash.
      this.logger?.errorWhileLoggingRequest(e);
    }

    const response = await this.#respondToRequest(request, outerContext, res);

    try {
      const networkInfo = {
        connectionSocket: outerContext.socket,
        nodeResponse:     res
      };
      await accessLog.send('requestEnded', request, response, networkInfo);
    } catch (e) {
      // Log it and move on rather than letting the system crash.
      this.logger?.errorWhileLoggingRequest(e);
    }

    return response;
  }

  /**
   * Runs the "network stack." This is called as the main function of the
   * {@link #runner}.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess Thread runner access object.
   */
  async #runNetwork(runnerAccess) {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down. (This would change in the
    // future if we switched to using async-events instead of Node callbacks at
    // this layer.)

    await runnerAccess.whenStopRequested();

    if (this.#logger) {
      this.#logger.stopping(this._impl_infoForLog);
    }

    // We do these in parallel, because there can be mutual dependencies, e.g.
    // the application might need to see the server stopping _and_ vice versa.
    await Promise.all([
      this._impl_socketStop(this.#willReload),
      this._impl_serverStop(this.#willReload)
    ]);

    if (this.#logger) {
      this.#logger.stopped(this._impl_infoForLog);
    }
  }

  /**
   * Starts the "network stack." This is called as the start function of the
   * {@link #runner}.
   */
  async #startNetwork() {
    if (this.#logger) {
      this.#logger.starting(this._impl_infoForLog);
    }

    await this._impl_serverStart();
    await this._impl_socketStart();

    if (this.#logger) {
      this.#logger.started(this._impl_infoForLog);
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
