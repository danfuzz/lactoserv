// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Socket } from 'node:net';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
import { WallClock } from '@this/clocks';
import { FormatUtils, IntfLogger } from '@this/loggy';

import { AsyncServerSocket } from '#p/AsyncServerSocket';
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

  /**
   * @type {AsyncServerSocket} Underlying server socket, wrapped for `async`
   * friendliness.
   */
  #asyncServer;

  /** @type {Condition} Are there currently any open sockets? */
  #anySockets = new Condition();

  /** @type {Set} Set of all currently-known sockets. */
  #sockets = new Set();

  /** @type {Threadlet} Thread which runs the low-level of the stack. */
  #runner = new Threadlet(() => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {object} options Standard construction options.
   */
  constructor(options) {
    super(options);

    this.#logger      = options.logger ?? null;
    this.#rateLimiter = options.rateLimiter ?? null;
    this.#asyncServer = new AsyncServerSocket(options.interface, options.protocol, this.#logger);
  }

  /** @override */
  _impl_loggableInfo() {
    return this.#asyncServer.loggableInfo;
  }

  /** @override */
  async _impl_socketStart(isReload) {
    await this.#runner.start();
    await this.#asyncServer.start(isReload);
  }

  /** @override */
  async _impl_socketStop(willReload) {
    await this.#asyncServer.stop(willReload);
    await this.#runner.stop();
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
        if (rest.length !== 0) {
          // The event is only supposed to have the one argument.
          connLogger.weirdConnectionEvent(socket, ...rest);
        }
        connLogger.opened({
          local:  FormatUtils.addressPortString(socket.localAddress, socket.localPort),
          remote: FormatUtils.addressPortString(socket.remoteAddress, socket.remotePort)
        });
      } catch (e) {
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

    // The `end` event is what a socket gets when the far side proactively
    // closes the connection. We react by just closing our side. Note that
    // network sockets are generally created in "allow half open" mode, which is
    // why we have to explicitly close our side. And, to be clear, we _don't_
    // want to disable half-open, because we ourselves want to be able to close
    // our side without worrying about how the remote side reacts.
    socket.once('end', () => {
      connLogger?.remoteClosed();
      socket.destroySoon(); // "Soon" means "after all pending data is written."
    });

    let loggedClose = false;

    const logClose = (...args) => {
      if (!connLogger) {
        return;
      }

      if (!loggedClose) {
        // Only log this once. (That is, don't re-log it if there's a second
        // call to this function, for whatever reason.)
        connLogger.totalBytesWritten(socket.bytesWritten);
      }

      if (args.length === 0) {
        // Only log a non-error close once, and only if no error close has been
        // reported.
        if (!loggedClose) {
          connLogger.closed('ok');
        }
      } else {
        connLogger.closed('error', ...args);
      }

      loggedClose = true;
    };

    socket.on('error', (error) => {
      // A `close` event gets emitted right after this event -- which performs
      // connection cleanup -- so there's no need to do anything other than log
      // the event in this handler.
      logClose(error);
    });

    socket.once('close', () => {
      this.#sockets.delete(socket);
      if (this.#sockets.size === 0) {
        this.#anySockets.value = false;
      }

      logClose();
    });

    this._prot_newConnection(socket, connLogger);
  }

  /**
   * Handles a dropped connection (that is, a connection automatically dropped
   * by the underlying `Server` instance, based on its configured
   * `maxConnections`).
   *
   * **Note:** As of this writing, `maxConnections` is never set on server
   * sockets, which means we should never see any dropped connections (at this
   * layer).
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
      WallClock.waitForMsec(TcpWrangler.#SOCKET_TIMEOUT_CLOSE_GRACE_PERIOD_MSEC)
    ]);

    if (socket.destroyed) {
      logger?.destroyed();
      return;
    }

    logger?.destroyingForcefully();
    socket.destroy();

    await PromiseUtil.race([
      closedCond.whenTrue(),
      WallClock.waitForMsec(TcpWrangler.#SOCKET_TIMEOUT_CLOSE_GRACE_PERIOD_MSEC)
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
    while (!this.#runner.shouldStop()) {
      const event =
        await this.#asyncServer.accept(this.#runner.whenStopRequested());
      if (event) {
        switch (event.type) {
          case 'connection': {
            this.#handleConnection(...event.args);
            break;
          }
          case 'drop': {
            this.#handleDrop(...event.args);
            break;
          }
        }
      }
    }

    await this.#anySockets.whenFalse();
  }


  //
  // Static members
  //

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
}
