// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as http from 'node:http';

import express from 'express';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
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

    this.#application    = express();
    this.#protocolServer = http.createServer();
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
