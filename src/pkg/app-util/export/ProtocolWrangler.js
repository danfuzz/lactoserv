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

  /** @type {object} Socket contruction / listenting options. */
  #socketOptions;

  /** @type {object} High-level application (Express-like thing). */
  #application;

  /** @type {object} High-level protocol server (`HttpServer`-like thing). */
  #protocolServer;

  /** @type {?object} Low-level server socket (`net.Server`-like thing). */
  #serverSocket = null;

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
    this.#protocolServer = this._impl_createServer(hostOptions);

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
   * @returns {object} The low-level server socket. This is a _direct_ instance
   * of `net.Server` or similar.
   */
  get serverSocket() {
    return this.#serverSocket;
  }

  /**
   * Issues a `listen()` call to this instance's server socket, or does the
   * equivalent, to commence servicing connections.
   */
  listen() {
    this._impl_listen(this.#serverSocket, this.#socketOptions);

    if (this.#logger) {
      this.#logger.listening(this.loggableInfo);
    }
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
   * Performs protocol-specific actions to make a server be ready to start
   * taking requests.
   *
   * @abstract
   */
  async protocolStart() {
    if (this.#logger) {
      this.#logger.wranglerStarting(this.loggableInfo);
    }

    this.#serverSocket = this._impl_createServerSocket();

    // Hook the server socket to the protocol server. If we had created the
    // protocol server "naively," it would have had a "built-in" server socket,
    // and this (here) is the small price we pay for directly instantiating the
    // server socket. TODO: This is where we might interpose a `WriteSpy.`
    this.#serverSocket.on('connection', (socket) => {
      this.#protocolServer.emit('connection', socket);
    });

    // Likewise, hook the protocol server to the (Express-like) application.
    this.#protocolServer.on('request', this.#application);

    await this._impl_protocolStart();

    if (this.#logger) {
      this.#logger.wranglerStarted(this.loggableInfo);
    }
  }

  /**
   * Performs protocol-specific actions when this instance's high-level server
   * (e.g., the thing that understands HTTP2) is asked to stop taking requests.
   *
   * @abstract
   */
  async protocolStop() {
    if (this.#logger) {
      this.#logger.wranglerStopping(this.loggableInfo);
    }

    await this._impl_protocolStop();

    if (this.#logger) {
      this.#logger.wranglerStopped(this.loggableInfo);
    }
  }

  /**
   * Performs protocol-specific actions to wait until a server has stopped.
   *
   * @abstract
   */
  async protocolWhenStopped() {
    return this._impl_protocolWhenStopped();
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
  _impl_createServer(hostOptions) {
    return Methods.abstract(hostOptions);
  }

  /**
   * Creates the server socket (or equivalent). This is expected to be a
   * _low-level_ server socket, which is to say _not_ one that inherently speaks
   * any higher-level protocol such as TLS, HTTP, etc.
   *
   * @abstract
   * @param {?object} options Socket-related options, passed through from the
   *   constructor.
   * @returns {object} Server socket, _direct_ instance of `net.Server` or
   *   similar.
   */
  _impl_createServerSocket(options) {
    return Methods.abstract(options);
  }

  /**
   * Subclass-specific implementation of {@link #listen}.
   *
   * @param {object} serverSocket Server socket, as previously returned from a
   *   call to {@link #_impl_createServerSocket}.
   * @param {?object} options Socket-related options, as were passed to the
   *   constructor.
   * @abstract
   */
  _impl_listen(serverSocket, options) {
    Methods.abstract(serverSocket, options);
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
   * Subclass-specific implementation of {@link #protocolStart}.
   *
   * @abstract
   */
  async _impl_protocolStart() {
    Methods.abstract();
  }

  /**
   * Subclass-specific implementation of {@link #protocolStop}.
   *
   * @abstract
   */
  async _impl_protocolStop() {
    Methods.abstract();
  }

  /**
   * Subclass-specific implementation of {@link #protocolWhenStopped}.
   *
   * @abstract
   */
  async _impl_protocolWhenStopped() {
    Methods.abstract();
  }
}
