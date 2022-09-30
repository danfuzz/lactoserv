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
  // Note: Default constructor is fine here.

  /**
   * Makes the underlying application instance, i.e. an instance of
   * `express:Express` or thing that is (approximately) compatible with same.
   *
   * **Implementation note:** Subclasses are responsible for remembering the
   * value they return here, if needed.
   *
   * @abstract
   * @returns {object} `express.Express`-like thing.
   */
  createApplication() {
    return this._impl_createApplication();
  }

  /**
   * Makes the underlying high-level-protocol-speaking server instance, i.e. an
   * instance of `http.HttpServer` or thing that is (approximately) compatible
   * with same.
   *
   * **Implementation note:** Subclasses are responsible for remembering the
   * value they return here, if needed.
   *
   * @abstract
   * @param {?object} certOptions Certificate options, or `null` if this
   *   instance returned `false` from {@link #usesCertificates}.
   * @returns {object} `http.HttpServer`-like thing.
   */
  createServer(certOptions) {
    return this._impl_createServer(certOptions);
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
   * Indicates whether or not this instance requires certificate options
   * when creating a server.
   *
   * @abstract
   * @returns {boolean} `true` iff certificate options need to be passed to
   *   {@link #createServer}.
   */
  usesCertificates() {
    return this._impl_usesCertificates();
  }

  /**
   * Subclass-specific implementation of {@link #createApplication}.
   *
   * @abstract
   * @returns {object} `express.Express`-like thing.
   */
  _impl_createApplication() {
    return Methods.abstract();
  }

  /**
   * Subclass-specific implementation of {@link #createServer}.
   *
   * @abstract
   * @param {?object} certOptions Certificate options, if needed.
   * @returns {object} `http.HttpServer`-like thing.
   */
  _impl_createServer(certOptions) {
    return Methods.abstract(certOptions);
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

  /**
   * Subclass-specific implementation of {@link #usesCertificates}.
   *
   * @abstract
   * @returns {boolean} Answer to the question.
   */
  _impl_usesCertificates() {
    return Methods.abstract();
  }
}
