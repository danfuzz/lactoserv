// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import express from 'express';

import * as http from 'http';
import * as https from 'https';
import * as path from 'node:path';
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

  /**
   * Constructs an instance.
   *
   * @param {object|null} config Configuration object; `null` to get a default
   *   of listening for HTTP on port 8080.
   */
  constructor(config = null) {
    this.#config = config ?? { port: 8080, protocol: 'http' };

    this.#app = express();
    this.#server = null;

    this.#addRoutes();
  }

  /**
   * Starts the server.
   */
  async start() {
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
        app.removeListener('listening', handleListening);
        app.removeListener('error',     handleError);

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

      app.on('listening', handleListening);
      app.on('error',     handleError);

      const server = this.#createServer();
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
    const server = this.#server;

    if (server.listening) {
      server.close();
    }

    return this.whenStopped();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
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
    // TODO: Way more stuff. For now, just serve some static files.
    const assetsDir = url.fileURLToPath(new URL('../assets', import.meta.url));
    this.#app.use('/', express.static(assetsDir))
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
