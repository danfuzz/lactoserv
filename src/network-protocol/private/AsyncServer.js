// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Server, createServer as netCreateServer } from 'node:net';

import { FormatUtils } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Utility class for doing some of the lowest-level server socket manipulation,
 * in a way that is `async`-friendly.
 */
export class AsyncServer {
  /** @type {object} Parsed server socket `interface` specification. */
  #interface;

  /** @type {string} The protocol name; just used for logging. */
  #protocol;

  /**
   * @type {Server} The underlying server socket instance (Node library class).
   */
  #serverSocket;

  /**
   * Constructs an instance.
   *
   * @param {object} iface Parsed server socket `interface` specification.
   * @param {string} protocol The protocol name; just used for logging.
   */
  constructor(iface, protocol) {
    // Note: `interface` is a reserved word.
    this.#interface    = MustBe.plainObject(iface);
    this.#protocol     = MustBe.string(protocol);
    this.#serverSocket = AsyncServer.createServer(iface);
  }

  /**
   * @returns {object} Loggable info about this instance, including interface
   * address and current-listening info.
   */
  get loggableInfo() {
    const address = this.#serverSocket.address();
    const iface   = FormatUtils.networkInterfaceString(this.#interface);

    return {
      protocol:  this.#protocol,
      interface: iface,
      ...(address
        ? { listening: FormatUtils.networkInterfaceString(address) }
        : {})
    };
  }

  /** @returns {Server} The underlying server socket instance. */
  get serverSocket() {
    return this.#serverSocket;
  }

  /**
   * Performs a `close()` on the underlying {@link Server}, unless it is already
   * closed in which case this method does nothing. This method async-returns
   * once the server has actually stopped listening for connections.
   */
  static async close() {
    await AsyncServer.serverClose(this.#serverSocket);
  }

  /**
   * Performs a `listen()` on the underlying {@link Server}. This method
   * async-returns once the server is actually listening.
   */
  async listen() {
    await AsyncServer.serverListen(this.#serverSocket, this.#interface);
  }


  //
  // Static members
  //

  /**
   * @type {object} "Prototype" of server socket creation options. See
   * `ProtocolWrangler` class doc for details.
   */
  static #CREATE_PROTO = Object.freeze({
    allowHalfOpen:         { default: true },
    keepAlive:             null,
    keepAliveInitialDelay: null,
    noDelay:               null,
    pauseOnConnect:        null
  });

  /**
   * @type {object} "Prototype" of server listen options. See `ProtocolWrangler`
   * class doc for details.
   */
  static #LISTEN_PROTO = Object.freeze({
    address:   { map: (v) => ({ host: (v === '*') ? '::' : v }) },
    backlog:   null,
    exclusive: null,
    fd:        null,
    port:      null
  });

  /**
   * Creates an instance of {@link Server}, based on the full `interface`
   * options.
   *
   * @param {object} options The interface options.
   * @returns {Server} An appropriately-constructed {@link Server} instance.
   */
  static createServer(options) {
    return netCreateServer(this.#extractConstructorOptions(options));
  }

  /**
   * Performs a `close()` on the given {@link Server}, unless it is already
   * closed in which case this method does nothing. This method async-returns
   * once the server has actually stopped listening for connections.
   *
   * @param {Server} server The server instance.
   */
  static async serverClose(server) {
    if (!server.listening) {
      // Apparently already closed.
      return;
    }

    server.close();

    // Wait for the server to claim to have stopped.
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
   * Performs a `listen()` on the given {@link Server}, with arguments based on
   * the full `interface` options. This method async-returns once the server is
   * actually listening.
   *
   * @param {Server} server The server instance.
   * @param {object} options The interface options.
   */
  static async serverListen(server, options) {
    // This `await new Promise` arrangement is done to get the `listen()` call
    // to be a good async citizen. Notably, the optional callback passed to
    // `listen()` is only ever sent a single `listening` event upon success and
    // never anything in case of an error.
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

      server.listen(this.#extractListenOptions(options));
    });
  }

  /**
   * Gets the options for a `Server` constructor(ish) call, given the full
   * server socket `interface` options.
   *
   * @param {object} options The interface options.
   * @returns {object} The constructor-specific options.
   */
  static #extractConstructorOptions(options) {
    return this.#fixOptions(options, this.#CREATE_PROTO);
  }

  /**
   * Gets the options for a `listen()` call, given the full server socket
   * `interface` options.
   *
   * @param {object} options The interface options.
   * @returns {object} The `listen()`-specific options.
   */
  static #extractListenOptions(options) {
    return this.#fixOptions(options, this.#LISTEN_PROTO);
  }

  /**
   * Trims down and "fixes" `options` using the given prototype. This is used
   * to convert from our incoming `interface` form to what's expected by Node's
   * `Server` creation methods.
   *
   * @param {object} options Original options.
   * @param {object} proto The "prototype" for what bindings to keep.
   * @returns {object} Pared down version.
   */
  static #fixOptions(options, proto) {
    const result = {};

    for (const [name, mod] of Object.entries(proto)) {
      const value = options[name];
      if (value === undefined) {
        if (mod?.default !== undefined) {
          result[name] = mod.default;
        }
      } else if (mod?.map) {
        Object.assign(result, (mod.map)(options[name]));
      } else {
        result[name] = options[name];
      }
    }

    return result;
  }
}
