// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as https from 'node:https';

import { TcpWrangler } from '#p/TcpWrangler';
import { WranglerContext } from '#p/WranglerContext';


/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends TcpWrangler {
  /**
   * High-level protocol server.
   *
   * @type {?https.Server}
   */
  #protocolServer = null;

  // @defaultConstructor

  /** @override */
  async _impl_init() {
    const hostOptions = this._prot_hostManager.getSecureServerOptions();
    const server      = https.createServer(hostOptions);

    server.on('request', (...args) => this._prot_incomingRequest(...args));

    // Set up an event handler to propagate the connection context. See
    // `WranglerContext.emitInContext()` for a treatise about what's going on.
    server.on('secureConnection', (socket) => WranglerContext.bindCurrent(socket));

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

    // TODO: Consider tracking connections and forcing things closed after a
    // timeout, similar to what's done with HTTP2.
  }
}
