// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as net from 'node:net';

import { Condition, Threadlet } from '@this/async';
import { FormatUtils, IntfLogger } from '@this/loggy';

import { IntfRateLimiter } from '#x/IntfRateLimiter';
import { ProtocolWrangler } from '#x/ProtocolWrangler';


/**
 * Wrangler for all TCP-based protocols (which is, as of this writing, all of
 * them... but HTTP3 will be here before we know it!).
 */
export class TcpWrangler extends ProtocolWrangler {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /** @type {?IntfRateLimiter} Rate limiter service to use, if any. */
  #rateLimiter;

  /** @type {net.Server} Server socket, per se. */
  #serverSocket;

  /** @type {object} Server socket `listen()` options. */
  #listenOptions;

  /** @type {object} Loggable info, minus any "active listening" info. */
  #loggableInfo = {};

  /** @type {Condition} Are there currently any open sockets? */
  #anySockets = new Condition();

  /** @type {Set} Set of all currently-known sockets. */
  #sockets = new Set();

  /** @type {Threadlet} Thread which runs the low-level of the stack. */
  #runner = new Threadlet(() => this.#start(), () => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {object} options Standard construction options.
   */
  constructor(options) {
    super(options);

    this.#logger        = options.logger ?? null;
    this.#rateLimiter   = options.rateLimiter ?? null;
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

    const serverOptions = {
      allowHalfOpen: true, // See `ProtocolWrangler` class doc for details.
      ...TcpWrangler.#trimOptions(options.socket, TcpWrangler.#CREATE_PROTO)
    };
    this.#serverSocket = net.createServer(serverOptions);

    this.#serverSocket.on('connection', (...args) => this.#handleConnection(...args));
    this.#serverSocket.on('drop', (...args) => this.#handleDrop(...args));
  }

  /** @override */
  async _impl_serverSocketStart() {
    return this.#runner.start();
  }

  /** @override */
  async _impl_serverSocketStop() {
    return this.#runner.stop();
  }

  /** @override */
  _impl_loggableInfo() {
    const address = this.#serverSocket.address();
    const info    = { ...this.#loggableInfo };

    if (address) {
      info.listening = FormatUtils.addressPortString(address.address, address.port);
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
  async #handleConnection(socket, ...rest) {
    if (this.#runner.shouldStop()) {
      // Immediately close a socket that managed to slip in while we're trying
      // to stop.
      socket.close();
      return;
    }

    const connLogger = this.#logger?.conn.$newId ?? null;

    this.#logger?.newConnection(connLogger.$meta.lastContext);

    if (connLogger) {
      try {
        connLogger.opened({
          local:  FormatUtils.addressPortString(socket.localAddress, socket.localPort),
          remote: FormatUtils.addressPortString(socket.remoteAddress, socket.remotePort)
        });
      } catch (e) {
        connLogger.weirdConnectionEvent(socket, ...rest);
        connLogger.error(e);
      }
    }

    if (this.#rateLimiter) {
      const granted = await this.#rateLimiter.newConnection(connLogger);
      if (!granted) {
        socket.destroy();
        return;
      }

      socket = this.#rateLimiter.wrapWriter(socket, connLogger);
    }

    this.#sockets.add(socket);
    this.#anySockets.value = true;

    socket.on('error', (error) => {
      // A `close` event gets emitted right after this event -- which performs
      // connection cleanup -- so there's no need to do anything other than log
      // the event in this handler.
      connLogger.connectionError(error);
    });

    socket.on('close', () => {
      this.#sockets.delete(socket);
      if (this.#sockets.size === 0) {
        this.#anySockets.value = false;
      }

      if (connLogger) {
        connLogger.totalBytesWritten(socket.bytesWritten);
        connLogger.closed();
      }
    });

    this._prot_newConnection(socket, connLogger);
  }

  /**
   * Handles a dropped connection (that is, a connection automatically dropped
   * by the underlying `Server` instance, based on its configured
   * `maxConnections`).
   *
   * @param {object} data Information about the dropped connection.
   */
  #handleDrop(data) {
    this.#logger?.droppedConnection(data);
  }

  /**
   * Runs the low-level stack. This is called as the main function of the
   * {@link #runner}.
   */
  async #run() {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down.
    await this.#runner.whenStopRequested();

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

    await this.#anySockets.whenFalse();
  }

  /**
   * Starts the low-level stack. This is called as the start function of the
   * {@link #runner}.
   */
  async #start() {
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


  //
  // Static members
  //

  /** @type {object} "Prototype" of server socket creation options. */
  static #CREATE_PROTO = Object.freeze({
    allowHalfOpen:         null,
    keepAlive:             null,
    keepAliveInitialDelay: null,
    noDelay:               null,
    pauseOnConnect:        null
  });

  /** @type {object} "Prototype" of server listen options. */
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
