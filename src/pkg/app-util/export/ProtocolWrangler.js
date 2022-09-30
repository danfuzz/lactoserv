// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';


/**
 * Base class for things that "wrangle" each of the server protocols that this
 * system understands. Concrete instances of this class get instantiated once
 * per server; multiple servers which happen to use the same protocol will each
 * use a separate instance of this class.
 */
export class ProtocolWrangler {
  /** @type {object} High-level application instance. */
  #application;

  /** @type {object} High-level protocol server instance. */
  #protocolServer;

  /**
   * Constructs an instance. Accepted options:
   *
   * * `hosts: object` -- Value returned from {@link
   *   HostManager.secureServerOptions}, if this instance is (possibly) expected
   *   to need to use certificates (etc.). Ignored for instances which don't do
   *   that sort of thing.
   *
   * @param {object} options Construction options, per the description above.
   */
  constructor(options) {
    this.#application    = this._impl_createApplication();
    this.#protocolServer = this._impl_createServer(options.hosts ?? null);
  }

  /**
   * @returns {object} The high-level application instance. This is an instance
   * of `express:Express` or thing that is (approximately) compatible with same.
   */
  get application() {
    return this.#application;
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
   * Makes the server socket (or equivalent), and listens on it. This is
   * expected to be a _low-level_ server socket, not one that inherently speaks
   * any higher-level protocol, such as TLS, HTTP, etc.
   *
   * **Implementation note:** Subclasses are responsible for remembering the
   * value they return here, if needed.
   *
   * @abstract
   * @param {object} options Options for a call to (something like) {@link
   *   net.Server.listen}
   * @returns {object} Server socket, either a {@link net.Server} per se, or
   *   a workalike of some sort.
   */
  createSocket(options) {
    return this._impl_createSocket(options);
  }

  /**
   * Performs protocol-specific actions to make a server be ready to start
   * taking requests.
   *
   * @abstract
   */
  async protocolStart() {
    return this._impl_protocolStart();
  }

  /**
   * Performs protocol-specific actions when this instance's high-level server
   * (e.g., the thing that understands HTTP2) is asked to stop taking requests.
   *
   * @abstract
   */
  async protocolStop() {
    return this._impl_protocolStop();
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
   * Subclass-specific implementation of {@link #createSocket}.
   *
   * @abstract
   * @param {object} options Listen options.
   * @returns {object} Server socket.
   */
  _impl_createSocket(options) {
    return Methods.abstract(options);
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
