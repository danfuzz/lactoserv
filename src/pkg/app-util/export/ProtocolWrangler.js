// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { IdGenerator } from '#x/IdGenerator';
import { Methods } from '@this/typey';


/**
 * Base class for things that "wrangle" each of the server protocols that this
 * system understands. Concrete instances of this class get instantiated once
 * per server; multiple servers which happen to use the same protocol will each
 * use a separate instance of this class.
 */
export class ProtocolWrangler {
  /** @type {string} Protocol name. */
  #protocolName;

  /** @type {?function(...*)} Logger, if logging is to be done. */
  #logger;

  /** @type {IdGenerator} ID generator to use, if logging is to be done. */
  #idGenerator;

  /** @type {object} High-level application (Express-like thing). */
  #application;

  /** @type {object} High-level protocol server (`HttpServer`-like thing). */
  #protocolServer;

  /**
   * Constructs an instance. Accepted options:
   *
   * * `hosts: object` -- Value returned from {@link
   *   HostManager.secureServerOptions}, if this instance is (possibly) expected
   *   to need to use certificates (etc.). Ignored for instances which don't do
   *   that sort of thing.
   * * `idGenerator: IdGenerator` -- ID generator to use, when doing logging.
   * * `logger: function(...*)` -- Logger to use to emit events about what the
   *   instance is doing. (If not specified, the instance won't do logging.)
   * * `socket: object` -- Options to use for creation of and/or listening on
   *   the low-level server socket. See docs for `net.createServer()` and
   *   `net.Server.listen()` for more details. Exception: `*` is treated as the
   *   wildcard name for the `host` interface.
   *
   * @param {object} options Construction options, per the description above.
   */
  constructor(options) {
    const hostOptions = options.hosts
      ? Object.freeze({ ...options.hosts })
      : null;

    this.#logger         = options.logger ?? null;
    this.#idGenerator    = options.idGenerator ?? null;
    this.#protocolName   = options.protocol;
    this.#application    = this._impl_createApplication();
    this.#protocolServer = this._impl_createProtocolServer(hostOptions);

    // Hook the protocol server to the (Express-like) application.
    this.#protocolServer.on('request', this.#application);

    if (this.#logger) {
      this.#logger.createdWrangler();
    }
  }

  /**
   * @returns {object} The high-level application instance. This is an instance
   * of `express:Express` or thing that is (approximately) compatible with same.
   */
  get application() {
    return this.#application;
  }

  /**
   * @returns {object} Object with bindings for reasonably-useful for logging
   * about this instance, particularly the low-level socket state.
   */
  get loggableInfo() {
    return this._impl_loggableInfo();
  }

  /** @returns {string} The protocol name. */
  get protocolName() {
    return this.#protocolName;
  }

  /**
   * @returns {object} The high-level protocol server instance. This is an
   * instance of `http.HttpServer` or thing that is (approximately) compatible
   * with same.
   */
  get protocolServer() {
    return this.#protocolServer;
  }

  /**
   * Starts this instance listening for connections and dispatching them to
   * the high-level application. This method async-returns once the instance has
   * actually gotten started.
   */
  async start() {
    if (this.#logger) {
      this.#logger.wranglerStarting(this.loggableInfo);
    }

    await this._impl_protocolStart();
    await this._impl_serverSocketStart();

    if (this.#logger) {
      this.#logger.wranglerStarted(this.loggableInfo);
    }
  }

  /**
   * Stops this instance from listening for any more connections. This method
   * async-returns once the instance has actually stopped.
   */
  async stop() {
    if (this.#logger) {
      this.#logger.wranglerStopping(this.loggableInfo);
    }

    await this._impl_serverSocketStop();
    await this._impl_protocolStop();

    if (this.#logger) {
      this.#logger.wranglerStopped(this.loggableInfo);
    }
  }

  /**
   * Creates the application instance to be returned by {@link #application}.
   *
   * @abstract
   * @returns {object} `express.Express`-like thing.
   */
  _impl_createApplication() {
    return Methods.abstract();
  }

  /**
   * Creates the protocol server instance to be returned by {@link
   * #protocolServer}.
   *
   * @abstract
   * @param {?object} hostOptions Host / certificate options, if needed.
   * @returns {object} `http.HttpServer`-like thing.
   */
  _impl_createProtocolServer(hostOptions) {
    return Methods.abstract(hostOptions);
  }

  /**
   * Subclass-specific implementation of {@link #loggableInfo}.
   *
   * @abstract
   * @returns {object} Object with interesting stuff about the server socket.
   */
  _impl_loggableInfo() {
    Methods.abstract();
  }

  /**
   * Performs starting actions specifically in service of the high-level
   * protocol (e.g. HTTP2), in advance of it being handed connections. This
   * should only async-return once the protocol really is ready.
   *
   * @abstract
   */
  async _impl_protocolStart() {
    Methods.abstract();
  }

  /**
   * Performs stop/shutdown actions specifically in service of the high-level
   * protocol (e.g. HTTP2), after it is no longer being handed connections. This
   * should only async-return once the protocol really is stopped.
   *
   * @abstract
   */
  async _impl_protocolStop() {
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
}
