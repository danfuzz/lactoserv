// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HttpWrangler } from '#p/HttpWrangler';
import { Http2Wrangler } from '#p/Http2Wrangler';
import { HttpsWrangler } from '#p/HttpsWrangler';

import express from 'express';

import * as url from 'url';

const wranglerClasses = new Map(Object.entries({
  http:  HttpWrangler,
  http2: Http2Wrangler,
  https: HttpsWrangler
}));

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
    const wranglerClass = wranglerClasses.get(config.protocol);

    if (wranglerClass === null) {
      throw new Error('Unknown protocol: ' + config.protocol);
    }

    this.#wrangler = new wranglerClass(config);
    this.#configureApplication();
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

  /**
   * Configures top-level application settings.
   */
  #configureApplication() {
    const app = this.#wrangler.app;

    // Means paths `/foo` and `/Foo` are different.
    app.set('case sensitive routing', true);

    // A/O/T `development`. Note: Per Express docs, this makes error messages be
    // "less verbose," so it may be reasonable to turn it off when debugging
    // things like Express routing weirdness etc.
    app.set('env', 'production');

    // Means paths `/foo` and `/foo/` are different.
    app.set('strict routing', true);

    // Squelches the response header advertisement.
    app.set('x-powered-by', false);
  }
}
