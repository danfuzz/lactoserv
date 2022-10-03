// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ProtocolWrangler } from '#x/ProtocolWrangler';

import { IdGenerator } from '@this/loggy';

import * as net from 'node:net';


/**
 * Wrangler for all TCP-based protocols (which is, as of this writing, all of
 * them... but HTTP3 will be here before we know it!).
 */
export class TcpWrangler extends ProtocolWrangler {
  /** @type {?function(...*)} Logger, if logging is to be done. */
  #logger;

  /** @type {IdGenerator} ID generator to use, if logging is to be done. */
  #idGenerator;

  /** @type {net.Server} Server socket, per se. */
  #serverSocket;

  /** @type {object} Server socket `listen()` options. */
  #listenOptions;

  /** @type {object} Loggable info, minus any "active listening" info. */
  #loggableInfo = {};

  /**
   * Constructs an instance.
   *
   * @param {object} options Standard construction options.
   */
  constructor(options) {
    super(options);

    this.#logger        = options.logger ?? null;
    this.#idGenerator   = options.idGenerator ?? null;
    this.#listenOptions =
      TcpWrangler.#trimOptions(options.socket, TcpWrangler.#LISTEN_PROTO);
    this.#loggableInfo  = {
      interface: this.#listenOptions.host,
      port:      this.#listenOptions.port,
      protocol:  options.protocol
    };

    if (this.#listenOptions.host === '*') {
      this.#listenOptions.host = '::';
      this.#loggableInfo.interface = '<any>';
    }

    this.#serverSocket = net.createServer(
      TcpWrangler.#trimOptions(options.socket, TcpWrangler.#CREATE_PROTO));

    this.#serverSocket.on('connection', (...args) => this.#handleConnection(...args));
  }

  /** @override */
  async _impl_serverSocketStart() {
    const serverSocket = this.#serverSocket;

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the optional callback passed to
    // `Server.listen()` is only ever sent a single `listening` event upon
    // success and never anything in case of an error.
    await new Promise((resolve, reject) => {
      function done(err) {
        serverSocket.removeListener('listening', handleListening);
        serverSocket.removeListener('error',     handleError);

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

      serverSocket.on('listening', handleListening);
      serverSocket.on('error',     handleError);

      serverSocket.listen(this.#listenOptions);
    });
  }

  /** @override */
  async _impl_serverSocketStop() {
    const serverSocket = this.#serverSocket;
    serverSocket.close();

    // If the server is still listening for connections, wait for it to claim
    // to have stopped.
    while (serverSocket.listening) {
      await new Promise((resolve, reject) => {
        function done(err) {
          serverSocket.removeListener('close', handleClose);
          serverSocket.removeListener('error', handleError);

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

        serverSocket.on('close', handleClose);
        serverSocket.on('error', handleError);
      });
    }
  }

  /** @override */
  _impl_loggableInfo() {
    const address = this.#serverSocket.address();
    const info    = { ...this.#loggableInfo };

    if (address) {
      const ip = /:/.test(address.address)
        ? `[${address.address}]` // More pleasant presentation for IPv6.
        : address.address;
      info.listening = `${ip}:${address.port}`;
    }

    return info;
  }

  /**
   * Handles a new incoming connection. This is called in response to the
   * receipt of a `connection` event from the server socket.
   *
   * **Note:** A "naively" opened protocol server (e.g. calling
   * `httpServer.listen(...)`) ends up with its own built-in and self-managed
   * server socket, but we're a bit fancier so we have to do this hookup more
   * manually. This is a relatively small price to pay for getting to be able to
   * have visibility on the actual network traffic.
   *
   * @param {net.Socket} socket Socket for the newly-opened connection.
   * @param {...*} rest Any other arguments that happened to be be part of the
   *   `connection` event.
   */
  #handleConnection(socket, ...rest) {
    if (this.#logger) {
      const connLogger = this.#logger.$newId;

      try {
        const { address, port } = socket.address(); // No need for the others.
        connLogger.connectedFrom({ address, port });
      } catch (e) {
        connLogger.weirdConnectionEvent(socket, ...rest);
      }

      socket.on('close', (hadError) => {
        // TODO: It looks like we don't necessarily get this event when the
        // server is getting shut down. Probably need to track connections,
        // similar to how HTTP2 tracks sessions.
        connLogger.totalBytesWritten(socket.bytesWritten);
        if (hadError) {
          connLogger.hadError();
        }
        connLogger.closed();
      });
    }

    // TODO: This is where we might interpose a `WriteSpy`.

    this._impl_newConnection(socket);
  }


  //
  // Static members
  //

  /** {object} "Prototype" of server socket creation options. */
  static #CREATE_PROTO = Object.freeze({
    allowHalfOpen:         null,
    keepAlive:             null,
    keepAliveInitialDelay: null,
    noDelay:               null,
    pauseOnConnect:        null
  });

  /** {object} "Prototype" of server listen options. */
  static #LISTEN_PROTO = Object.freeze({
    port:      null,
    host:      null,
    backlog:   null,
    exclusive: null
  });

  /**
   * Trims down `options` using the given prototype.
   *
   * @param {object} options Original options.
   * @param {object} proto The "prototype" for what bindings to keep.
   * @returns {object} Pared down version.
   */
  static #trimOptions(options, proto) {
    if (!options) {
      return {};
    }

    const result = {};

    for (const name in proto) {
      if (Object.hasOwn(options, name)) {
        result[name] = options[name];
      }
    }

    return result;
  }
}
