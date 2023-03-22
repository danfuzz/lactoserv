// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Server, Socket, createServer as netCreateServer } from 'node:net';
import * as timers from 'node:timers/promises';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
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

  /** @type {Server} Server socket, per se. */
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

    const listenOptions =
      TcpWrangler.#fixOptions(options.interface, TcpWrangler.#LISTEN_PROTO);
    const serverOptions =
      TcpWrangler.#fixOptions(options.interface, TcpWrangler.#CREATE_PROTO);

    this.#logger        = options.logger ?? null;
    this.#rateLimiter   = options.rateLimiter ?? null;
    this.#serverSocket  = netCreateServer(serverOptions);
    this.#listenOptions = listenOptions;
    this.#loggableInfo  = {
      interface: FormatUtils.networkInterfaceString(options.interface),
      protocol:  options.protocol
    };

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
      info.listening = FormatUtils.networkInterfaceString(address);
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
   * @param {Socket} socket Socket for the newly-opened connection.
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

    // Note: Doing a socket timeout is a good idea in general. But beyond that,
    // as of this writing, there's a bug in Node which causes it to consistently
    // leak memory when sockets aren't proactively timed out, see issue #42710
    // <https://github.com/nodejs/node/issues/42710>. We have observed memory
    // leakage consistent with the issue in this project, and the working
    // hypothesis is that setting this timeout will suffice as a fix /
    // workaround (depending on one's perspective).
    socket.setTimeout(TcpWrangler.#SOCKET_TIMEOUT_MSEC, () => {
      this.#handleTimeout(socket, connLogger);
    });

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
   * Handles a timed out socket.
   *
   * @param {Socket} socket The socket that timed out.
   * @param {?IntfLogger} logger Logger to use, if any.
   */
  async #handleTimeout(socket, logger) {
    logger = logger?.socketTimeout;

    if (socket.destroyed) {
      logger?.alreadyDestroyed();
      return;
    }

    const closedCond = new Condition();

    logger?.closing();
    socket.destroySoon();
    socket.once('close', () => {
      closedCond.value = true;
      logger?.closed();
    });

    await PromiseUtil.race([
      closedCond.whenTrue(),
      timers.setTimeout(TcpWrangler.#SOCKET_TIMEOUT_CLOSE_GRACE_PERIOD_MSEC)
    ]);

    if (socket.destroyed) {
      logger?.destroyed();
      return;
    }

    logger?.destroyingForcefully();
    socket.destroy();

    await PromiseUtil.race([
      closedCond.whenTrue(),
      timers.setTimeout(TcpWrangler.#SOCKET_TIMEOUT_CLOSE_GRACE_PERIOD_MSEC)
    ]);

    if (socket.destroyed) {
      logger?.destroyed();
    } else {
      logger?.givingUp();
    }
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
   * @type {object} "Prototype" of server listen options.  See
   * `ProtocolWrangler` class doc for details.
   */
  static #LISTEN_PROTO = Object.freeze({
    address:   { map: (v) => ({ host: (v === '*') ? '::' : v }) },
    backlog:   null,
    exclusive: null,
    fd:        null,
    port:      null
  });

  /**
   * @type {number} How long in msec to wait before considering a connected
   * socket (a/o/t a server socket doing a `listen()`) to be "timed out." When
   * timed out, a socket is closed proactively.
   */
  static #SOCKET_TIMEOUT_MSEC = 3 * 60 * 1000; // Three minutes.

  /**
   * @type {number} Grace period in msec after trying to close a socket due to
   * timeout, before doing it more forcefully.
   */
  static #SOCKET_TIMEOUT_CLOSE_GRACE_PERIOD_MSEC = 250; // Quarter of a second.

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
