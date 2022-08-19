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
  /** {ServerWrangler} Protocol-specific "wrangler." */
  #wrangler = null;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    switch (config.protocol) {
      case 'http': {
        this.#wrangler = new HttpWrangler(config);
        break;
      }
      case 'http2': {
        this.#wrangler = new Http2Wrangler(config);
        break;
      }
      case 'https': {
        this.#wrangler = new HttpsWrangler(config);
        break;
      }
    }

    this.#addRoutes();
  }

  /**
   * Starts the server.
   */
  async start() {
    return this.#wrangler.start();
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    return this.#wrangler.stop();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    return this.#wrangler.whenStopped();
  }

  /**
   * Adds routes to the Express instance.
   */
  #addRoutes() {
    const app = this.#wrangler.app;

    // TODO: Way more stuff. For now, just serve some static files.
    const assetsDir = url.fileURLToPath(new URL('../assets', import.meta.url));
    app.use('/', express.static(assetsDir))
  }
}
