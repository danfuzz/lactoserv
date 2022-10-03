// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import express from 'express';

import * as https from 'node:https';

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

    this.#protocolServer.on('request', this.#application);
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
    // Nothing to do in this case.
  }

  /** @override */
  _impl_newConnection(socket) {
    this.#protocolServer.emit('connection', socket);
  }
}
