// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http from 'node:http';

import { IntfLogger } from '@this/loggy';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

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
    this.#protocolServer = http.createServer();
  }

  /** @override */
  _impl_application() {
    return null;
  }

  /** @override */
  async _impl_applicationStart(isReload_unused) {
    // Nothing to do in this case.
  }

  /** @override */
  async _impl_applicationStop(willReload_unused) {
    this.#protocolServer.close();
    this.#protocolServer.closeIdleConnections();

    // TODO: Consider tracking connections and forcing things closed after a
    // timeout, similar to what's done with HTTP2.
  }

  /** @override */
  async _impl_initialize() {
    // Nothing needed here.
  }

  /** @override */
  _impl_server() {
    return this.#protocolServer;
  }
}
