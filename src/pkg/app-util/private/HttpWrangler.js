// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import express from 'express';

import * as http from 'node:http';

/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
  /** @type {express} Express-like application. */
  #application;

  /** @type {http.Server} High-level protocol server. */
  #protocolServer;

  constructor(options) {
    super(options);

    this.#application    = express();
    this.#protocolServer = http.createServer();

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
