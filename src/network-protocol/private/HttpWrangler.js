// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http from 'node:http';

import express from 'express';

import { IntfLogger } from '@this/loggy';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /** @type {express} Express-like application. */
  #application;

  /** @type {http.Server} High-level protocol server. */
  #protocolServer;

  /**
   * Constructs an instance.
   *
   * @param {object} options Construction options, per the base class spec.
   */
  constructor(options) {
    super(options);

    this.#logger         = options.logger?.http ?? null;
    this.#application    = express();
    this.#protocolServer = http.createServer();

    // Explicitly set the default socket timeout, as doing thise _might_ help
    // prevent memory leaks. See the longer comment in the `Http2Wrangler`
    // constructor for details. The bug noted there is HTTP2-specific, but the
    // possibility of socket leakage seems like it could easily happen here too.
    this.#protocolServer.timeout = HttpWrangler.#SOCKET_TIMEOUT_MSEC;

    // TODO: Either remove this entirely, if it turns out that the server
    // timeout is useless (for us), or add something useful here.
    this.#protocolServer.on('timeout', () => {
      this.#logger?.serverTimeout();
    });
  }

  /** @override */
  _impl_application() {
    return this.#application;
  }

  /** @override */
  async _impl_applicationStart() {
    // Nothing to do in this case.
  }

  /** @override */
  async _impl_applicationStop() {
    this.#protocolServer.close();
    this.#protocolServer.closeIdleConnections();

    // TODO: Consider tracking connections and forcing things closed after a
    // timeout, similar to what's done with HTTP2.
  }

  /** @override */
  _impl_server() {
    return this.#protocolServer;
  }


  //
  // Static members
  //

  /**
   * @type {number} How long in msec to wait before considering a socket
   * "timed out."
   */
  static #SOCKET_TIMEOUT_MSEC = 3 * 60 * 1000; // Three minutes.
}
