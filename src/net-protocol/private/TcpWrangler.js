// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';
import { Socket } from 'node:net';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
import { WallClock } from '@this/clocks';
import { FormatUtils } from '@this/loggy-intf';
import { IntfLogger } from '@this/loggy-intf';

import { AsyncServerSocket } from '#p/AsyncServerSocket';
import { IntfRateLimiter } from '#x/IntfRateLimiter';
import { ProtocolWrangler } from '#x/ProtocolWrangler';
import { WranglerContext } from '#p/WranglerContext';


/**
 * Wrangler for all TCP-based protocols (which is, as of this writing, all of
 * them... but HTTP3 will be here before we know it!).
 */
export class TcpWrangler extends ProtocolWrangler {
  /** @type {?IntfRateLimiter} Rate limiter service to use, if any. */
  #rateLimiter;

  /**
   * @type {Array<*>} Arguments to pass to the {@link AsyncServerSocket}
   * constructor.
   */
  #asyncServerArgs;

  /**
   * @type {?AsyncServerSocket} Underlying server socket, wrapped for `async`
   * friendliness. Set in {@link #init}.
   */
  #asyncServer = null;

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

    this.#rateLimiter     = options.rateLimiter ?? null;
    this.#asyncServerArgs = [options.interface, options.protocol];
  }

  /** @override */
  async init(logger, isReload) {
    this.#asyncServer = new AsyncServerSocket(...this.#asyncServerArgs, this.logger);

    await super.init(logger, isReload);
  }

  /** @override */
  get _impl_infoForLog() {
    return this.#asyncServer.infoForLog;
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

    const connLogger = this.logger?.conn.$newId ?? null;

    this.logger?.newConnection(connLogger.$meta.lastContext);

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
        // Shouldn't happen. Almost certainly indicative of a bug in this
        // project. Nonetheless, we don't want this failure to take the whole
        // system down, so we just "meta-log" and keep going.
        connLogger.errorWhileLogging(e);
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

    // We can only set up the connection context once the rate-limiter wrapping
    // is done (if that was configured). That is, `socket` at this point is
    // either the original one that came as an argument to this method _or_ the
    // rate-limiter wrapper that was just constructed.
    const connectionCtx = WranglerContext.forConnection(this, socket, connLogger);
    connectionCtx.emitInContext(this._impl_server(), 'connection', socket);

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
    // closes the connection. We react by just closing our side, after a very
    // small delay; the delay is to give the protocol layer a chance to cleanly
    // react to the event before we fully close the socket. Note that network
    // sockets are generally created in "allow half-open" mode, which is why we
    // have to explicitly close our side. And, to be clear, we _don't_ want to
    // disable half-open, because we ourselves want to be able to close our side
    // without forcing the other side to close too.
    socket.once('end', async () => {
      connLogger?.remoteClosed();
      await timers.setTimeout(TcpWrangler.#SOCKET_WAIT_TIME_AFTER_HALF_CLOSE_MSEC);

      // "Soon" means "after all pending data has been written and flushed."
      socket.destroySoon();
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
        // Only log a non-error close once, and only if no errorful close has
        // been reported.
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
    this.logger?.droppedConnection(data);
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

  /**
   * @type {number} Grace period in msec after receiving an `end` event from
   * a raw socket (which indicates that the readable side was closed), before
   * reacting by closing the writable side.
   */
  static #SOCKET_WAIT_TIME_AFTER_HALF_CLOSE_MSEC = 10;
}
