// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as net from 'node:net';

import express from 'express';

import { Threadlet } from '@this/async';
import { Methods } from '@this/typey';

import { RequestLogger } from '#p/RequestLogger';


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
  #logger = null;

  /**
   * @type {?RequestLogger} HTTP(ish) request logger, if logging is to be done.
   */
  #requestLogger = null;

  /**
   * @type {boolean} Has the high-level application been initialized by this
   * (base) class?
   */
  #applicationInitialized = false;

  /** @type {Threadlet} Threadlet which runs the "network stack." */
  #runner = new Threadlet(() => this.#startNetwork(), () => this.#runNetwork());

  /**
   * Constructs an instance. Accepted options:
   *
   * * `hosts: object` -- Value returned from {@link
   *   HostManager.secureServerOptions}, if this instance is (possibly) expected
   *   to need to use certificates (etc.). Ignored for instances which don't do
   *   that sort of thing.
   * * `requestLog: BaseService` -- Request log to send to. (If not specified,
   *   the instance won't do request logging.)
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
    const { logger, requestLogger } = options;

    if (logger) {
      this.#logger = logger;
    }

    if (requestLogger) {
      this.#requestLogger = new RequestLogger(requestLogger, logger);
    }
  }

  /**
   * @returns {object} The high-level application instance. This is an instance
   * of `express:Express` or thing that is (approximately) compatible with same.
   */
  get application() {
    const app = this._impl_application();

    if (!this.#applicationInitialized) {
      // First time getting the application; set it up. Note: We can't do this
      // in this (base) class's constructor, because the subclass instance isn't
      // yet constructed at that point. We could alternatively make the subclass
      // call a (nominally) protected method to do the setup, but that's a lot
      // of mess to deal with. Doing it here keeps things pretty tidy, even if
      // it's just a little surprising.
      app.use('/', (req, res, next) => { this.#handleRequest(req, res, next); });
      this.#applicationInitialized = true;
    }

    return app;
  }

  /**
   * Starts this instance listening for connections and dispatching them to
   * the high-level application. This method async-returns once the instance has
   * actually gotten started.
   *
   * @throws {Error} Thrown if there was any trouble starting up.
   */
  async start() {
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
   * Informs the higher-level stack of a connection received by the lower-level
   * stack.
   *
   * @abstract
   * @param {net.Socket} socket Socket representing the newly-made connection.
   */
  _impl_newConnection(socket) {
    Methods.abstract(socket);
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
   * "First licks" request handler. This gets added as the first middlware
   * handler to the high-level application.
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {function(?*)} next Function which causes the next-bound middleware
   *   to run.
   */
  #handleRequest(req, res, next) {
    if (this.#requestLogger) {
      const reqLogger = this.#requestLogger.logRequest(req, res);
      ProtocolWrangler.#bindLogger(req, reqLogger);
      ProtocolWrangler.#bindLogger(res, reqLogger);
    }

    next();
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


  //
  // Static members
  //

  /**
   * @type {symbol} Symbol used when binding a logger to a request or response
   * object.
   */
  static #LOGGER_SYMBOL = Symbol('loggerFor' + this.name);

  /**
   * Gets the logger which was bound to the given (presumed) request or response
   * object.
   *
   * @param {object} reqOrRes The request or response object.
   * @returns {?function(...*)} logger The logger boun to it, if any.
   */
  static getLogger(reqOrRes) {
    return reqOrRes[this.#LOGGER_SYMBOL] ?? null;
  }

  /**
   * Binds a logger to the given (presumed) request or response object.
   *
   * @param {object} reqOrRes The request or response object.
   * @param {function(...*)} logger The logger to bind to it.
   */
  static #bindLogger(reqOrRes, logger) {
    reqOrRes[this.#LOGGER_SYMBOL] = logger;
  }
}
