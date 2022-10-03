// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { IdGenerator } from '#x/IdGenerator';

import { Threadoid } from '@this/async';
import { Methods } from '@this/typey';


/**
 * Base class for things that "wrangle" each of the server protocols that this
 * system understands. Concrete instances of this class get instantiated once
 * per server; multiple servers which happen to use the same protocol will each
 * use a separate instance of this class.
 *
 * Each instance manages a low-level server socket, whose connections ultimately
 * get plumbed to an (Express-like) application instance. This class is
 * responsible for constructing the application instance and getting it hooked
 * up to the rest of this class, but it does not do any configuration internally
 * to the application (which is up to the clients of this class).
 */
export class ProtocolWrangler {
  /** @type {string} Protocol name. */
  #protocolName;

  /** @type {?function(...*)} Logger, if logging is to be done. */
  #logger;

  /** @type {IdGenerator} ID generator to use, if logging is to be done. */
  #idGenerator;

  /** @type {object} High-level application (Express-like thing). */
  #application;

  /** @type {Threadoid} Threadoid which runs the "network stack." */
  #runner = new Threadoid(() => this.#startNetwork(), () => this.#runNetwork());

  /**
   * Constructs an instance. Accepted options:
   *
   * * `hosts: object` -- Value returned from {@link
   *   HostManager.secureServerOptions}, if this instance is (possibly) expected
   *   to need to use certificates (etc.). Ignored for instances which don't do
   *   that sort of thing.
   * * `idGenerator: IdGenerator` -- ID generator to use, when doing logging.
   * * `logger: function(...*)` -- Logger to use to emit events about what the
   *   instance is doing. (If not specified, the instance won't do logging.)
   * * `socket: object` -- Options to use for creation of and/or listening on
   *   the low-level server socket. See docs for `net.createServer()` and
   *   `net.Server.listen()` for more details. Exception: `*` is treated as the
   *   wildcard name for the `host` interface.
   *
   * @param {object} options Construction options, per the description above.
   */
  constructor(options) {
    const hostOptions = options.hosts
      ? Object.freeze({ ...options.hosts })
      : null;

    this.#logger       = options.logger ?? null;
    this.#idGenerator  = options.idGenerator ?? null;
    this.#protocolName = options.protocol;
  }

  /**
   * @returns {object} The high-level application instance. This is an instance
   * of `express:Express` or thing that is (approximately) compatible with same.
   */
  get application() {
    return this._impl_application();
  }

  /** @returns {string} The protocol name. */
  get protocolName() {
    return this.#protocolName;
  }

  /**
   * Starts this instance listening for connections and dispatching them to
   * the high-level application. This method async-returns once the instance has
   * actually gotten started.
   *
   * @throws {Error} Thrown if there was any trouble starting up.
   */
  async start() {
    const runResult = this.#runner.run();

    // If `whenStarted()` loses, that means there was trouble starting, in which
    // case we return the known-rejected result of the run.
    return Promise.race([
      this.#runner.whenStarted(),
      runResult
    ]);
  }

  /**
   * Stops this instance from listening for any more connections. This method
   * async-returns once the instance has actually stopped. If there was an
   * error thrown while running, that error in turn gets thrown by this method.
   * If this instance wasn't running in the first place, this method does
   * nothing.
   *
   * @throws {Error} Whatever problem occurred during running.
   */
  async stop() {
    if (!this.#runner.isRunning()) {
      return null;
    }

    // "Re-run" to get hold of the final result of running.
    const result = this.#runner.run();

    this.#runner.stop();
    return result;
  }

  /**
   * Gets the (Express-like) application instance.
   *
   * @abstract
   * @returns {object} The (Express-like) application instance.
   */
  _impl_application() {
    Methods.abstract();
  }

  /**
   * Gets an object with bindings for reasonably-useful for logging about this
   * instance, particularly the low-level socket state.
   *
   * @abstract
   * @returns {object} Object with interesting stuff about the server socket.
   */
  _impl_loggableInfo() {
    Methods.abstract();
  }

  /**
   * Informs the higher-level stack of a connection received by the lower-level
   * stack.
   *
   * @abstract
   * @param {net.Socket} socket Socket representing the newly-made connection.
   */
  _impl_newConnection(socket) {
    Methods.abstract(socket);
  }

  /**
   * Performs starting actions specifically in service of the high-level
   * protocol (e.g. HTTP2), in advance of it being handed connections. This
   * should only async-return once the protocol really is ready.
   *
   * @abstract
   */
  async _impl_protocolStart() {
    Methods.abstract();
  }

  /**
   * Performs stop/shutdown actions specifically in service of the high-level
   * protocol (e.g. HTTP2), after it is no longer being handed connections. This
   * should only async-return once the protocol really is stopped.
   *
   * @abstract
   */
  async _impl_protocolStop() {
    Methods.abstract();
  }

  /**
   * Starts the server socket, that is, gets it listening for connections. This
   * should only async-return once the socket is really listening.
   *
   * @abstract
   */
  async _impl_serverSocketStart() {
    Methods.abstract();
  }

  /**
   * Stops the server socket, that is, closes it and makes it stop listening.
   * This should only async-return once the socket is truly stopped / closed.
   *
   * @abstract
   */
  async _impl_serverSocketStop() {
    Methods.abstract();
  }

  /**
   * Starts the "network stack." This is called as the start function of the
   * {@link #runner}.
   */
  async #startNetwork() {
    if (this.#logger) {
      this.#logger.starting(this._impl_loggableInfo());
    }

    await this._impl_protocolStart();
    await this._impl_serverSocketStart();

    if (this.#logger) {
      this.#logger.started(this._impl_loggableInfo());
    }
  }

  /**
   * Runs the "network stack." This is called as the main function of the
   * {@link #runner}.
   */
  async #runNetwork() {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down. (This would change in the
    // future if we switched to using async-events instead of Node callbacks at
    // this layer.)

    await this.#runner.whenStopRequested();

    if (this.#logger) {
      this.#logger.stopping(this._impl_loggableInfo());
    }

    await this._impl_serverSocketStop();
    await this._impl_protocolStop();

    if (this.#logger) {
      this.#logger.stopped(this._impl_loggableInfo());
    }
  }
}
