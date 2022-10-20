// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as https from 'node:https';

import express from 'express';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends TcpWrangler {
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
