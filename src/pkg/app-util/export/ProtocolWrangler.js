// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';


/**
 * Common interface for "wrangling" each of the server protocols that this
 * system understands. Instances of this class get instantiated once per
 * server; multiple servers which happen to use the same protocol will each use
 * a separate instance of this class.
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
    return Methods.abstract();
  }

  /**
   * Makes the underlying high-level server instance, i.e. an instance of
   * `http.HttpServer` or thing that is (approximately) compatible with same.
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
    return Methods.abstract(certOptions);
  }

  /**
   * Makes the server socket (or equivalent), and listens on it. This is
   * expected to be a _low-level_ server socket, not one that inherently speaks
   * any higher-level protocol, such as TLS, HTTP, etc.
   *
   * **Implementation note:** Subclasses are responsible for remembering the
   * value they return here, if needed.
   *
   * @param {object} options Options for a call to (something like) {@link
   *   net.Server.listen}
   * @returns {object} Server socket, either a {@link net.Server} per se, or
   *   a workalike of some sort.
   */
  createSocket(options) {
    return Methods.abstract(options);
  }

  /**
   * Performs protocol-specific actions to make a server is ready to start
   * taking requests.
   *
   * @abstract
   */
  async protocolStart() {
    Methods.abstract();
  }

  /**
   * Performs protocol-specific actions when this instance's high-level server
   * (e.g., the thing that understands HTTP2) is asked to stop taking requests.
   *
   * @abstract
   */
  async protocolStop() {
    Methods.abstract();
  }

  /**
   * Performs protocol-specific actions to wait until a server has stopped.
   *
   * @abstract
   */
  async protocolWhenStopped() {
    Methods.abstract();
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
    return Methods.abstract();
  }
}
