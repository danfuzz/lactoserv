// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http from 'node:http';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
  /** @type {http.Server} High-level protocol server. */
  #protocolServer = null;

  // Note: The default constructor suffices here.

  /** @override */
  async _impl_serverStart(isReload_unused) {
    // Nothing to do in this case.
  }

  /** @override */
  async _impl_serverStop(willReload_unused) {
    this.#protocolServer.close();
    this.#protocolServer.closeIdleConnections();

    // TODO: Consider tracking connections and forcing things closed after a
    // timeout, similar to what's done with HTTP2.
  }

  /** @override */
  async _impl_initialize() {
    if (!this.#protocolServer) {
      this.#protocolServer = http.createServer();
    }
  }

  /** @override */
  _impl_server() {
    return this.#protocolServer;
  }
}
