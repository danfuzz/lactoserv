// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as https from 'node:https';

import express from 'express';

import { IntfLogger } from '@this/loggy';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends TcpWrangler {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /** @type {express} Express-like application. */
  #application;

  /** @type {?https.Server} High-level protocol server. */
  #protocolServer;

  /**
   * Constructs an instance.
   *
   * @param {object} options Construction options, per the base class spec.
   */
  constructor(options) {
    super(options);

    this.#logger         = options.logger?.https ?? null;
    this.#application    = express();
    this.#protocolServer = https.createServer(options.hosts);
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
}
