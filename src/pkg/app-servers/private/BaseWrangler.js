// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HostManager } from '@this/app-hosts';
import { Methods } from '@this/typey';

import * as net from 'node:net';


/**
 * Common interface for "wrangling" each of the different server protocols.
 * Concrete instances of this class remain "hidden" behind a public-facing
 * server instance, so as to prevent clients of this package from reaching in
 * and messing with internals.
 */
export class BaseWrangler {
  // Note: Default constructor is fine here.

  /**
   * Makes the underlying application instance, i.e. an instance of
   * `express:Express` or thing that is (approximately) compatible with same.
   *
   * @abstract
   */
  createApplication() {
    Methods.abstract();
  }

  /**
   * Makes the underlying server instance, i.e. an instance of `node:HttpServer`
   * or thing that is (approximately) compatible with same.
   *
   * @abstract
   * @param {?HostManager} hostManager Host manager to use, or `null` if not
   *   configured.
   */
  createServer(hostManager) {
    Methods.abstract(hostManager);
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
   * Indicates whether or not this instance requires certificate information
   * when creating a server.
   *
   * @abstract
   * @returns {boolean} `true` iff certificate information needs to be passed to
   *   {@link #createServer}.
   */
  usesCertificates() {
    return Methods.abstract();
  }
}
