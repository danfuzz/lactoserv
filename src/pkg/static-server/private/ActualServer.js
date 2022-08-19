// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HttpWrangler } from '#p/HttpWrangler';
import { Http2Wrangler } from '#p/Http2Wrangler';
import { HttpsWrangler } from '#p/HttpsWrangler';

import express from 'express';

import * as path from 'node:path';
import { setTimeout } from 'node:timers/promises';
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
    if (this.#serverInterface !== null) {
      return this.#serverInterface.start();
    }

    const app = this.#app;

    const listenOptions = {
      host: '::',
      port: this.#config.port
    };

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the callback passed to
    // `Server.listen()` cannot (historically) be counted on to get used as an
    // error callback. TODO: Maybe there is a better way to do this these days?
    await new Promise((resolve, reject) => {
      function done(err) {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      }

      function handleListening() {
        done(null);
      }

      function handleError(err) {
        done(err);
      }

      const server = this.#server;
      server.on('listening', handleListening);
      server.on('error',     handleError);
      server.listen(listenOptions);
      this.#server = server;
    });

    // TODO: More stuff?
    console.log('Started server.');

    const gotPort = this.#server.address().port;

    console.log('Listening for %s on port %o.', this.#config.protocol, gotPort);
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    if (this.#serverInterface !== null) {
      return this.#serverInterface.stop();
    }

    const server = this.#server;

    if (server.listening) {
      server.close();
    }

    server.closeAllConnections();

    return this.whenStopped();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    if (this.#serverInterface !== null) {
      return this.#serverInterface.whenStopped();
    }

    const server = this.#server;

    if (!server.listening) {
      return;
    }

    await new Promise((resolve, reject) => {
      function done(err) {
        server.removeListener('close', handleClose);
        server.removeListener('error', handleError);

        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      }

      function handleClose() {
        done(null);
      }

      function handleError(err) {
        done(err);
      }

      server.on('close', handleClose);
      server.on('error', handleError);
    });
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

  /**
   * Creates a server for the protocol as indicated during construction.
   *
   * @returns {net.Server} An appropriate server object.
   */
  #createServer() {
    const app = this.#app;
    const config = this.#config;

    switch (config.protocol) {
      case 'http': {
        return http.createServer(app);
      }

      case 'https': {
        const options = {
          key: config.key,
          cert: config.cert
        }
        return https.createServer(config, app);
      }

      default: {
        throw new Error('Unknown protocol: ' + config.protocol)
      }
    }
  }
}
