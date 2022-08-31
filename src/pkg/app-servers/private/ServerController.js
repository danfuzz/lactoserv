// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { WranglerFactory } from '#p/WranglerFactory';

import { Condition } from '@this/async';

// Types referenced only in doc comments.
import { BaseWrangler } from '#p/BaseWrangler';
import { HostManager } from '#p/HostManager';
import * as express from 'express';
import * as net from 'node:net';

/**
 * "Controller" for a single server. This wraps both a (concrete subclass of a)
 * {@link net.Server} object _and_ an {@link express.Application} which
 * _exclusively_ handles that server.
 */
export class ServerController {
  /** @type {string} Server name. */
  #name;

  /**
   * @type {HostManager} Host manager with bindings for all valid hostnames for
   * this instance.
   */
  #hostManager;

  /** @type {string} Interface address. */
  #interface;

  /** @type {number} Port number. */
  #port;

  /** @type {string} Protocol. */
  #protocol;

  /** @type {BaseWrangler} Protocol-specific "wrangler." */
  #wrangler;

  /** @type {net.Server} Server instance (the direct networking thingy). */
  #server;

  /**
   * @type {express.Application} Application instance which exclusively handles
   * the underlying server of this instance.
   */
  #serverApp;

  /** @type {Condition} Is the server stopped or trying to stop? */
  #stopping = new Condition();

  /**
   * Constructs an insance.
   *
   * @param {object} serverConfig Server information configuration item. Same
   *   as what's in the exposed config object, except with `host` / `hosts`
   *   replaced with `hostManager`.
   */
  constructor(serverConfig) {
    this.#name        = serverConfig.name;
    this.#hostManager = serverConfig.hostManager;
    this.#interface   = serverConfig.interface;
    this.#port        = serverConfig.port;
    this.#protocol    = serverConfig.protocol;
    this.#wrangler    = WranglerFactory.forProtocol(this.#protocol);
    this.#server      = this.#wrangler.createServer(this.#hostManager);
    this.#serverApp   = this.#wrangler.createApplication();

    this.#configureServerApp();
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#name;
  }

  /**
   * @returns {express.Application} Application instance which exclusively
   * handles the underlying server of this instance.
   */
  get serverApp() {
    return this.#serverApp;
  }

  /**
   * Starts the server.
   */
  async start() {
    if (this.#stopping.value) {
      throw new Error('Server stopping or already stopped.');
    }

    const server = this.#server;
    await this.#wrangler.protocolStart(server);

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
      server.on('request',   this.#serverApp);

      server.listen(this.#listenOptions);
    });

    this.#log('Started server.');
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    if (this.#stopping.value) {
      // Already stopping, just wait for the existing procedure to complete.
      await this.whenStopped();
      return;
    }

    this.#log('Stopping server.');

    await this.#wrangler.protocolStop();

    this.#server.removeListener('request', this.#serverApp);
    this.#server.close();

    this.#stopping.value = true;

    await this.whenStopped();

    this.#log('Server stopped.');
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    await this.#stopping.whenTrue();
    await this.#wrangler.protocolWhenStopped();

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
   * @returns {{host: string, port: number}} Options for doing a `listen()` on a
   * server socket. `host` in the return value corresponds to the network
   * interface.
   */
  get #listenOptions() {
    return {
      host: (this.#interface === '*') ? '::' : this.#interface,
      port: this.#port
    };
  }

  /**
   * @returns {{name: string, interface: string, port: number, protocol:
   * string}} Object with bindings for reasonably-useful logging.
   */
  get #loggableInfo() {
    const address = this.#server.address();
    const info = {
      name:      this.#name,
      interface: (this.#interface === '*') ? '<any>' : this.#interface,
      port:      this.#port,
      protocol:  this.#protocol
    };

    if (address) {
      const ip = /:/.test(address.address)
        ? `[${address.address}]` // More pleasant presentation for IPv6.
        : address.address;
      info.listening = `${ip}:${address.port}`;
    }

    return info;
  }

  /**
   * Configures {@link #serverApp}.
   */
  #configureServerApp() {
    const app = this.#serverApp;

    // Means paths `/foo` and `/Foo` are different.
    app.set('case sensitive routing', true);

    // A/O/T `development`. Note: Per Express docs, this makes error messages be
    // "less verbose," so it may be reasonable to turn it off when debugging
    // things like Express routing weirdness etc. Or, maybe this project's needs
    // are so modest that it's better to just leave it in `development` mode
    // permanently.
    app.set('env', 'production');

    // Means paths `/foo` and `/foo/` are different.
    app.set('strict routing', true);

    // Squelches the response header advertisement for Express.
    app.set('x-powered-by', false);

    // TODO: Temporary logging to see what's going on.
    app.use('/', (req, res_unused, next) => {
      console.log('##### request: %o', {
        hostname: req.hostname, subdomains: req.subdomains
      });
      next();
    });
  }

  /**
   * Logs a message about the instance, including the protocol, interface, and
   * port.
   *
   * @param {string} msg The topline of the message.
   */
  #log(msg) {
    const info = this.#loggableInfo;

    console.log('%s', msg);
    console.log(`  name:      ${info.name}`);
    console.log(`  protocol:  ${info.protocol}`);
    console.log(`  interface: ${info.interface}`);
    console.log(`  port:      ${info.port}`);

    if (info.listening) {
      console.log(`  listening: ${info.listening}`);
    }
  }
}
