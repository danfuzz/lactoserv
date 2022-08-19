// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';
import * as path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import * as url from 'url';

/**
 * Common interface for "wrangling" each of the different server protocols.
 */
export class ServerWrangler {
  /** {object} Configuration info. */
  #config;

  /** {HttpServer} `HttpServer`(-like) instance. */
  #server;

  /** {Express} `Express`(-like) application object. */
  #app;

  /** {boolean} Is the server stopped or trying to stop? */
  #stopping = false;

  /** {Promise} Promise that resolves when {@link #stopping} becomes true. */
  #whenStopping = false;

  /** {function} Function to call in order to resolve {@link #whenStopping}. */
  #resolveWhenStopping;

  /**
   * Constructs an instance.
   */
  constructor(config, server, app) {
    this.#config = config;
    this.#server = server;
    this.#app = app;

    this.#whenStopping = new Promise((resolve) => {
      this.#resolveWhenStopping = () => resolve(true);
    });
  }

  /** {Express} `Express`(-like) application object. */
  get app() {
    return this.#app;
  }

  /** {HttpServer} `HttpServer`(-like) instance. */
  get server() {
    return this.#server;
  }

  /** {boolean} Is the server stopped or trying to stop? */
  get stopping() {
    return this.#stopping;
  }

  /**
   * Starts listening for connections. Returns after listening has actually
   * begun.
   */
  async start() {
    if (this.#stopping) {
      throw new Error('Server stopping or already stopped.');
    }

    await this.sub_start();

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the callback passed to
    // `Server.listen()` cannot (historically) be counted on to get used as an
    // error callback. TODO: Maybe there is a better way to do this these days?
    await new Promise((resolve, reject) => {
      const server = this.#server;

      function done(err) {
        server.removeListener('listening', handleListening);
        server.removeListener('error',     handleError);

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

      server.on('listening', handleListening);
      server.on('error',     handleError);
      server.on('request',   this.#app);

      const listenOptions = {
        host: this.#config.host,
        port: this.#config.port
      };

      server.listen(listenOptions);
    });
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    if (!this.#stopping) {
      this.sub_stop();
      this.#server.removeListener('request', this.#app);
      this.#server.close();
      this.#stopping = true;
    }

    return this.whenStopped();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    if (!this.#stopping) {
      await this.#whenStopping;
    }

    await this.sub_whenStopped();

    const server = this.#server;

    // If the server is still listening for connections, wait for it to claim
    // to have stopped.
    while (server.listening) {
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
  }

  /**
   * Performs subclass-related actions for {@link #start}. This method must be
   * overridden in the subclass.
   */
  sub_start() {
    throw new Error('Abstract method.');
  }

  /**
   * Performs subclass-related actions for {@link #stop}. This method must be
   * overridden in the subclass.
   */
  sub_stop() {
    throw new Error('Abstract method.');
  }

  /**
   * Performs subclass-related actions for {@link #whenStopped}. This method
   * must be overridden in the subclass.
   */
  sub_whenStopped() {
    throw new Error('Abstract method.');
  }
}
