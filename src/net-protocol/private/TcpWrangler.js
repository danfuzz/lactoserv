// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Socket } from 'node:net';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
import { WallClock } from '@this/clocky';
import { FormatUtils, IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';

import { AsyncServerSocket } from '#p/AsyncServerSocket';
import { IntfRateLimiter } from '#x/IntfRateLimiter';
import { ProtocolWrangler } from '#x/ProtocolWrangler';
import { WranglerContext } from '#p/WranglerContext';


/**
 * Wrangler for all TCP-based protocols (which is, as of this writing, all of
 * them... but HTTP3 will be here before we know it!).
 */
export class TcpWrangler extends ProtocolWrangler {
  /**
   * Rate limiter service to use, if any.
   *
   * @type {?IntfRateLimiter}
   */
  #rateLimiter;

  /**
   * Arguments to pass to the {@link AsyncServerSocket} constructor.
   *
   * @type {Array<*>}
   */
  #asyncServerArgs;

  /**
   * Underlying server socket, wrapped for `async` friendliness. Set in {@link
   * #init}.
   *
   * @type {?AsyncServerSocket}
   */
  #asyncServer = null;

  /**
   * Are there currently any open sockets?
   *
   * @type {Condition}
   */
  #anySockets = new Condition();

  /**
   * Set of all currently-known sockets.
   *
   * @type {Set}
   */
  #sockets = new Set();

  /**
   * Thread which runs the low-level of the stack.
   *
   * @type {Threadlet}
   */
  #runner = new Threadlet((ra) => this.#run(ra));

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
  async init(logger) {
    this.#asyncServer = new AsyncServerSocket(...this.#asyncServerArgs, logger);

    await super.init(logger);
  }

  /** @override */
  get _impl_infoForLog() {
    return this.#asyncServer.infoForLog;
  }

  /**
   * Hands a new connection off to the high-level protocol layer. It is expected
   * to arrange for the connection to be appropriately tracked, and for requests
   * that come in on that connection to get reported to the base class via
   * {@link #_prot_incomingRequest}.
   *
   * @param {WranglerContext} context The context for the connection, which
   *   notably includes a reference to the underlying network socket.
   */
  async _impl_newConnection(context) {
    throw Methods.abstract(context);
  }

  /** @override */
  async _impl_socketStart() {
    await this.#runner.start();
    await this.#asyncServer.start();
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
    if (this._prot_isStopping()) {
      // Immediately close a socket that managed to slip in while we're trying
      // to stop.
      socket.close();
      return;
    }

    const connLogger = this.#makeConnectionLogger(socket, ...rest);

    if (this.#rateLimiter) {
      const granted = await this.#rateLimiter.call('newConnection', connLogger);
      if (!granted) {
        socket.destroy();
        return;
      }

      socket = await this.#rateLimiter.call('wrapWriter', socket, connLogger);
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
    // closes the connection. We react by just closing our side, after a very
    // small delay; the delay is to give the protocol layer a chance to cleanly
    // react to the event before we fully close the socket. Note that network
    // sockets are generally created in "allow half-open" mode, which is why we
    // have to explicitly close our side. And, to be clear, we _don't_ want to
    // disable half-open, because we ourselves want to be able to close our side
    // without forcing the other side to close too.
    socket.once('end', async () => {
      connLogger?.remoteClosed();
      await WallClock.waitForMsec(TcpWrangler.#SOCKET_WAIT_TIME_AFTER_HALF_CLOSE_MSEC);

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

    // Set up the context, and then call down to our concrete subclass to do the
    // last bit of connection setup. We intentionally only do this after we've
    // set up everything we can at this layer.
    const context = WranglerContext.forConnection(this, socket, connLogger);
    await this._impl_newConnection(context);
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
   * Makes a new connection logger, and does initial logging about the
   * connection; or does nothing if this instance isn't doing logging.
   *
   * @param {Socket} socket Socket for the newly-opened connection.
   * @param {...*} rest Any other arguments that happened to be be part of the
   *   `connection` event.
   * @returns {?IntfLogger} Connection logger to use, or `null` if not to do
   *   logging.
   */
  #makeConnectionLogger(socket, ...rest) {
    const logger = this.logger;

    if (!logger) {
      return null;
    }

    const connLogger = logger.conn.$newId;

    logger.newConnection(connLogger.$meta.lastContext);

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

    return connLogger;
  }

  /**
   * Runs the low-level stack. This is called as the main function of the {@link
   * #runner}.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess Thread runner access object.
   */
  async #run(runnerAccess) {
    while (!runnerAccess.shouldStop()) {
      const event =
        await this.#asyncServer.accept(runnerAccess.whenStopRequested());
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
   * How long in msec to wait before considering a connected socket (a/o/t a
   * server socket doing a `listen()`) to be "timed out." When timed out, a
   * socket is closed proactively.
   *
   * @type {number}
   */
  static #SOCKET_TIMEOUT_MSEC = 3 * 60 * 1000; // Three minutes.

  /**
   * Grace period in msec after trying to close a socket due to timeout, before
   * doing it more forcefully.
   *
   * @type {number}
   */
  static #SOCKET_TIMEOUT_CLOSE_GRACE_PERIOD_MSEC = 250; // Quarter of a second.

  /**
   * Grace period in msec after receiving an `end` event from a raw socket
   * (which indicates that the readable side was closed), before reacting by
   * closing the writable side.
   *
   * @type {number}
   */
  static #SOCKET_WAIT_TIME_AFTER_HALF_CLOSE_MSEC = 10;
}
