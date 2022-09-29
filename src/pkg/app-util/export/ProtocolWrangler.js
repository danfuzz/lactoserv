// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';

import * as net from 'node:net';


/**
 * Common interface for "wrangling" each of the server protocols that this
 * system understands.
 */
export class ProtocolWrangler {
  // Note: Default constructor is fine here.

  /**
   * Makes the underlying application instance, i.e. an instance of
   * `express:Express` or thing that is (approximately) compatible with same.
   *
   * @abstract
   * @returns {object} `express:Express`-like thing.
   */
  createApplication() {
    return Methods.abstract();
  }

  /**
   * Makes the underlying server instance, i.e. an instance of `node:HttpServer`
   * or thing that is (approximately) compatible with same.
   *
   * @abstract
   * @param {?object} certOptions Certificate options, or `null` if this
   *   instance returned `false` from {@link #usesCertificates}.
   * @returns {object} `node:HttpServer`-like thing.
   */
  createServer(certOptions) {
    return Methods.abstract(certOptions);
  }

  /**
   * Performs protocol-specific actions for {@link #start}.
   *
   * @abstract
   * @param {net.Server} server Server instance to be wrangled.
   */
  protocolStart(server) {
    Methods.abstract(server);
  }

  /**
   * Performs protocol-specific actions for {@link #stop}.
   *
   * @abstract
   */
  protocolStop() {
    Methods.abstract();
  }

  /**
   * Performs protocol-specific actions for {@link #whenStopped}.
   *
   * @abstract
   */
  protocolWhenStopped() {
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
