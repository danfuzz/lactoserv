// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ManualPromise, Threadlet } from '@this/async';
import { ProductInfo } from '@this/host';
import { IntfLogger } from '@this/loggy-intf';
import { IncomingRequest, IntfRequestHandler, OutgoingResponse, RequestContext,
  TypeNodeRequest, TypeNodeResponse }
  from '@this/net-util';
import { Methods, MustBe } from '@this/typey';

import { IntfHostManager } from '#x/IntfHostManager';
import { IntfRateLimiter } from '#x/IntfRateLimiter';
import { IntfRequestLogger } from '#x/IntfRequestLogger';
import { RequestLogHelper } from '#p/RequestLogHelper';
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
   * Optional host manager; only needed for some protocols.
   *
   * @type {?IntfHostManager}
   */
  #hostManager;

  /**
   * Rate limiter service to use, if any.
   *
   * @type {?IntfRateLimiter}
   */
  #rateLimiter;

  /**
   * Request handler.
   *
   * @type {IntfRequestHandler}
   */
  #requestHandler;

  /**
   * Helper for HTTP-ish request logging, or `null` to not do any such logging.
   *
   * @type {?RequestLogHelper}
   */
  #logHelper;

  /**
   * Return value for {@link #interface}.
   *
   * @type {object}
   */
  #interfaceObject;

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
  #runner = new Threadlet(() => this.#startNetwork(), () => this.#runNetwork());

  /**
   * Is a system reload in progress (either during start or stop)?
   *
   * @type {boolean}
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
      interface: interfaceConfig,
      rateLimiter,
      requestHandler,
      requestLogger
    } = options;

    this.#hostManager    = hostManager ?? null;
    this.#rateLimiter    = rateLimiter ?? null;
    this.#requestHandler = MustBe.object(requestHandler);
    this.#logHelper      = requestLogger ? new RequestLogHelper(requestLogger) : null;
    this.#serverHeader   = ProtocolWrangler.#makeServerHeader();

    this.#interfaceObject = Object.freeze({
      address: interfaceConfig.address ?? null,
      fd:      interfaceConfig.fd      ?? null,
      port:    interfaceConfig.port    ?? null
    });
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
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async init(logger, isReload) {
    this.#logger    = logger;
    this.#reloading = isReload;

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
   * @param {boolean} isReload Is this action due to an in-process reload?
   * @throws {Error} Thrown if there was any trouble starting up.
   */
  async start(isReload) {
    if (isReload !== this.#reloading) {
      throw new Error('`isReload` mismatch.');
    }

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
    this.#reloading = willReload;
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
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async _impl_serverStart(isReload) {
    Methods.abstract(isReload);
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
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async _impl_socketStart(isReload) {
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
   * @param {TypeNodeRequest} req Request object.
   * @param {TypeNodeResponse} res Response object.
   */
  _prot_incomingRequest(req, res) {
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

    try {
      const requestContext = new RequestContext(this.interface, context.remoteInfo);
      const request        = IncomingRequest.fromNodeRequest(req, requestContext, this.#requestLogger);

      logger?.incomingRequest({
        ...context.ids,
        requestId: request.id,
        url:       request.urlForLog
      });

      if (this.#logHelper) {
        this.#respondToRequestUsingLogHelper(request, context, res);
      } else {
        this.#respondToRequest(request, context, res);
      }
    } catch (e) {
      // This probably indicates a bug in this project. That is, our goal is for
      // this not to be possible. That said, as of this writing, this is
      // theorized to occur in practice when the socket for a request gets
      // closed after the request was received but before it managed to get
      // dispatched.
      logger?.errorDuringIncomingRequest(url, e);
      const socketState = {
        closed:        socket.closed,
        destroyed:     socket.destroyed,
        readable:      socket.readable,
        readableEnded: socket.readableEnded,
        writableEnded: socket.writableEnded
      };
      logger?.socketState(url, socketState);

      // In case the response was never finished, this might unwedge things.
      res.statusCode = 500; // "Internal Server Error."
      res.end();
    }
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
   * @returns {OutgoingResponse} The response to send.
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
      return OutgoingResponse.makeMetaResponse(400); // "Bad Request."
    }

    try {
      const result = await this.#requestHandler.handleRequest(request, null);

      if (result instanceof OutgoingResponse) {
        return result;
      } else if (result === null) {
        // The configured `requestHandler` didn't actually handle the request.
        // Respond with a vanilla `404` error. (If the client wants something
        // fancier, they can do it themselves.)
        const bodyExtra = request.urlForLog;
        return OutgoingResponse.makeNotFound({ bodyExtra });
      } else {
        // Caught by our direct caller, `#respondToRequest()`.
        throw new Error(`Strange result from \`handleRequest\`: ${result}`);
      }
    } catch (e) {
      // `500` == "Internal Server Error."
      const bodyExtra = e.stack ?? e.message ?? '<unknown>';
      return OutgoingResponse.makeMetaResponse(500, { bodyExtra });
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
   * @returns {OutgoingResponse} The response object that was ultimately sent
   *   (or was at least ulitmately attempted to be sent).
   */
  async #respondToRequest(request, outerContext, res) {
    const reqLogger = request.logger;

    let result      = null;
    let closeSocket = false;

    try {
      if (this.#rateLimiter) {
        const granted = await this.#rateLimiter.newRequest(reqLogger);
        if (!granted) {
          // Send the error response, and wait for it to be (believed to be)
          // sent. Then just thwack the underlying socket. The hope is that the
          // waiting above will make it likely that the far side will actually
          // see the 503 ("Service Unavailable") response.
          result      = OutgoingResponse.makeMetaResponse(503);
          closeSocket = true;
        }
      }

      result ??= await this.#handleRequest(request, outerContext);
    } catch (e) {
      // `500` == "Internal Server Error."
      const bodyExtra = e.stack ?? e.message ?? '<unknown error>';
      result = OutgoingResponse.makeMetaResponse(500, { bodyExtra });
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
      closeSocket = true;
    }

    if (closeSocket) {
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
   * #logHelper} is non-`null`. This is what arranges for request/response
   * logging to happen. Notably, the call into `#logHelper` has to be made early
   * during request dispatch so that the timing measurements will be maximally
   * accurate. And in fact, this method (right here) gets called at about as
   * good a spot as can be managed.
   *
   * **Note:** There is nothing set up to catch errors thrown by this method. It
   * is not supposed to `throw` (directly or indirectly).
   *
   * @param {IncomingRequest} request Request object.
   * @param {WranglerContext} outerContext The outer context of `request`.
   * @param {TypeNodeResponse} res Low-level response object.
   * @returns {OutgoingResponse} The response object that was ultimately sent
   *   (or was at least ulitmately attempted to be sent).
   */
  async #respondToRequestUsingLogHelper(request, outerContext, res) {
    // We use a `ManualPromise` here so that we can call `logRequest()` before
    // proceeding with any actual response work. If we didn't do that, we could
    // end up doing a significant amount of the work of request handling
    // synchronously before `#logHelper` had a chance to start _its_ work (which
    // notably typically involves getting the current time).
    const responseMp = new ManualPromise();

    const networkInfo = {
      connectionSocket: outerContext.socket,
      nodeRequest:      res.req,
      nodeResponse:     res,
      responsePromise:  responseMp.promise
    };

    this.#logHelper.logRequest(request, networkInfo);

    const result = this.#respondToRequest(request, outerContext, res);
    responseMp.resolve(result);

    return result;
  }

  /**
   * Runs the "network stack." This is called as the main function of the {@link
   * #runner}.
   */
  async #runNetwork() {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down. (This would change in the
    // future if we switched to using async-events instead of Node callbacks at
    // this layer.)

    await this.#runner.whenStopRequested();

    if (this.#logger) {
      this.#logger.stopping(this._impl_infoForLog);
    }

    // We do these in parallel, because there can be mutual dependencies, e.g.
    // the application might need to see the server stopping _and_ vice versa.
    await Promise.all([
      this._impl_socketStop(this.#reloading),
      this._impl_serverStop(this.#reloading)
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

    await this._impl_serverStart(this.#reloading);
    await this._impl_socketStart(this.#reloading);

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
