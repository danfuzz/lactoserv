// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';
import * as path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import * as url from 'url';

/**
 * Interface for `Http2Server`.
 */
export class Http2Interface {
  /** {object} Configuration info. */
  #config;

  /** {Http2SecureServer} Server instance. */
  #server;

  /** {Express} Express(-like) application object. */
  #app;

  /** {boolean} Already closing or closed? */
  #closing = false;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    this.#config = config;

    const options = {
      key: config.key,
      cert: config.cert,
      allowHTTP1: true
    }

    this.#server = http2.createSecureServer(options);

    // Express needs to be wrapped in order to use HTTP2.
    this.#app = http2ExpressBridge(express);
  }

  get app() {
    return this.#app;
  }

  /**
   * Starts listening for connections. Returns after listening has actually
   * begun.
   */
  async start() {
    const server = this.#server;
    const listenOptions = {
      host: this.#config.host,
      port: this.#config.port
    };

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the callback passed to
    // `Server.listen()` cannot (historically) be counted on to get used as an
    // error callback. TODO: Maybe there is a better way to do this these days?
    await new Promise((resolve, reject) => {
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
      server.on('session',   (session) => this.#addSession(session));
      server.on('request',   this.#app);

      server.listen(listenOptions);
    });
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    const server = this.#server;

    if (!this.#closing) {
      server.removeListener('request', this.#app);
      server.close();

      // Node docs indicate one has to explicitly close all HTTP2 sessions.
      for (const s of this.#sessions) {
        if (!s.closed) {
          s.close();
        }
      }

      this.#closing = true;
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

    // If there are any remaining sessions, wait for them to stop. We can just
    // check the size of the `#sessions` set, because other code removes items
    // as they're closed.
    while (this.#sessions.size !== 0) {
      console.log('Waiting...');
      await setTimeout(1000);
      console.log('Done waiting.');
    }
  }


  #sessions = new Set();
  #zzz_count = 0;
  #addSession(session) {
    const id = this.#zzz_count++;
    const sessions = this.#sessions;

    sessions.add(session);
    console.log('### Added session %d', id);

    function removeSession() {
      console.log('### Removed session %d', id);
      sessions.delete(session);
    }

    session.on('close', removeSession);
    session.on('error', removeSession);
    session.on('frameError', removeSession);
    session.on('goaway', removeSession);

    if (this.#closing) {
      console.log('### Immediately closing session %d', id);
      session.close();
    }
  }
}
