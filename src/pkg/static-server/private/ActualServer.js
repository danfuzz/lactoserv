// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import express from 'express';

import * as http from 'http';
import * as path from 'node:path';
import * as url from 'url';

/**
 * Actual Http(s) server.
 */
export class ActualServer {
  /** {express} Express server application. */
  #app;

  /** {int} Port to listen on. */
  #port;

  /** {http.Server|null} Active HTTP server instance. */
  #server;

  /**
   * Constructs an instance.
   *
   * @param {int} [port = 8000] Port to listen on.
   */
  constructor(port = 8000) {
    this.#app = express();
    this.#port = port;
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
      port: this.#port
    };

    console.log('### actual 1');

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the callback passed to
    // `Server.listen()` cannot (historically) be counted on to get used as an
    // error callback. TODO: Maybe there is a better way to do this these days?
    await new Promise((resolve, reject) => {
      console.log('### actual 2');
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
        console.log('### actual 2-yay');
        done(null);
      }

      function handleError(err) {
        console.log('### actual 2-boo');
        done(err);
      }

      app.on('listening', handleListening);
      app.on('error',     handleError);

      const server = http.createServer(app);
      server.on('listening', handleListening);
      server.on('error',     handleError);
      server.listen(listenOptions);
      this.#server = server;

      console.log('### actual 3');
    });

    // TODO: More stuff?
    console.log('### actual 4');
    console.log('Started server. Yay?');

    const gotPort = this.#server.address().port;

    console.log('Listening on port ' + gotPort);
    this.#port = gotPort;
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
      console.log('### close 1');
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
        console.log('### close 3-yay');
        done(null);
      }

      function handleError(err) {
        console.log('### close 3-boo');
        done(err);
      }

      server.on('close', handleClose);
      server.on('error', handleError);
      console.log('### close 2');
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
}
