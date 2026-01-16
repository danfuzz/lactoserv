// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http from 'node:http';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
  /**
   * High-level protocol server.
   *
   * @type {http.Server}
   */
  #protocolServer = null;

  // @defaultConstructor

  /** @override */
  async _impl_init() {
    const server = http.createServer();

    server.on('request', (...args) => this._prot_incomingRequest(...args));

    this.#protocolServer = server;
  }

  /** @override */
  async _impl_newConnection(context) {
    context.emitInContext(this.#protocolServer, 'connection', context.socket);
  }

  /** @override */
  async _impl_serverStart() {
    // @emptyBlock
  }

  /** @override */
  async _impl_serverStop(willReload_unused) {
    this.#protocolServer.close();
    this.#protocolServer.closeIdleConnections();

    await this._prot_closeSocketsWithGracePeriod(HttpWrangler.#STOP_GRACE_PERIOD_MSEC);
  }


  //
  // Static members
  //

  /**
   * How long in msec to wait when stopping, after closing idle connections,
   * before force-closing remaining connections.
   *
   * @type {number}
   */
  static #STOP_GRACE_PERIOD_MSEC = 250;
}
