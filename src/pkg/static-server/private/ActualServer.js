// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HttpWrangler } from '#p/HttpWrangler';
import { Http2Wrangler } from '#p/Http2Wrangler';
import { HttpsWrangler } from '#p/HttpsWrangler';

import express from 'express';

import * as url from 'url';

/**
 * Actual Http(s) server.
 */
export class ActualServer {
  /** {object} Configuration info. */
  #config;

  /** {express} Express server application. */
  #app;

  /** {http.Server|null} Active HTTP server instance. */
  #server;

  #serverInterface = null;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    this.#config = config;

    switch (config.protocol) {
      case 'http': {
        this.#serverInterface = new HttpWrangler(config);
        this.#app = this.#serverInterface.app;
        this.#server = null;
        break;
      }
      case 'http2': {
        this.#serverInterface = new Http2Wrangler(config);
        this.#app = this.#serverInterface.app;
        this.#server = null;
        break;
      }
      case 'https': {
        this.#serverInterface = new HttpsWrangler(config);
        this.#app = this.#serverInterface.app;
        this.#server = null;
        break;
      }
    }

    this.#addRoutes();
  }

  /**
   * Starts the server.
   */
  async start() {
    return this.#serverInterface.start();
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    return this.#serverInterface.stop();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    return this.#serverInterface.whenStopped();
  }

  /**
   * Adds routes to the Express instance.
   */
  #addRoutes() {
    const app = (this.#serverInterface === null)
      ? this.#app : this.#serverInterface.app;

    // TODO: Way more stuff. For now, just serve some static files.
    const assetsDir = url.fileURLToPath(new URL('../assets', import.meta.url));
    app.use('/', express.static(assetsDir))
  }
}
