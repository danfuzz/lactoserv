// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import express from 'express';

import path from 'path';
import * as url from 'url';

/**
 * Actual Http(s) server.
 */
export class ActualServer {
  /** {express} Express server application. */
  #app;

  /** {int} Port to listen on. */
  #port;

  /**
   * Constructs an instance.
   *
   * @param {int} [port = 8000] Port to listen on.
   */
  constructor(port = 8000) {
    this.#app = express();
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
      app.listen(listenOptions);
      console.log('### actual 3');
    });

    // TODO: More stuff?
    console.log('### actual 4');
    console.log('Started server. Yay?');

    const gotPort = app.address().port;

    console.log('Listening on port ' + gotPort);
    this.#port = gotPort;
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
