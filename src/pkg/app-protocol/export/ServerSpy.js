// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as events from 'node:events';
import * as net from 'node:net';


/**
 * {@link net.Server} wrapper that allows for spying.
 *
 * The methods on this class can be called as if this instance were a {@link
 * net.Server}, except that return values that would "reveal" the underlying
 * server instance are rewritten to instead refer back to the instance of this
 * class which holds the server. Similarly, any sockets that the underlying
 * server produces get wrapped on their way out of instances of this class.
 */
export class ServerSpy extends events.EventEmitter {
  /** @type {net.Server} Server being spied upon. */
  #target;

  /** @type {?function(...*)} Logger to use. */
  #logger;

  /**
   * Constructs an instance. The given `options` are the same as defined by
   * {@link net.createServer}, with the following additions:
   *
   * * `logger: function(...*)` -- Logger to use to emit events about what the
   *   instance is doing. (If not specified, the instance won't do logging.)
   * * `target: net.Server` -- Server instance to wrap, instead of creating a
   *   new one in this constructor. If specified, then all of the usual
   *   constructor options are ignored.
   *
   * @param {object} [options = {}] Configuration options, as described above.
   */
  constructor(options = {}) {
    super();

    if (options.target) {
      this.#target = options.target;
    } else {
      const serverOptions = { ...options };
      delete serverOptions.logger;
      this.#target = net.createServer(serverOptions);
    }

    this.#logger = options.logger ?? null;

    this.#target
      .on('close',      (...args) => this.#handleClose(...args))
      .on('connection', (...args) => this.#handleConnection(...args))
      .on('error',      (...args) => this.#handleError(...args))
      .on('listening',  (...args) => this.#handleListening(...args))
      .on('drop',       (...args) => this.#handleDrop(...args));
  }

  /** @returns {boolean} Standard {@link net.Server} getter. */
  get listening() {
    return this.#target.listening;
  }

  /** @returns {number} Standard {@link net.Server} getter. */
  get maxConnections() {
    return this.#target.maxConnections;
  }

  /**
   * Standard {@link net.Server} setter.
   *
   * @param {number} count The number of connections.
   */
  set maxConnections(count) {
    this.#target.maxConnections = count;
  }

  /**
   * Standard {@link net.Server} method.
   *
   * @param {...*} args Arguments to pass to the underlying instance.
   * @returns {object} Return value from call to the underlying instance.
   */
  address(...args) {
    return this.#target.address(...args);
  }

  /**
   * Standard {@link net.Server} method.
   *
   * @param {...*} args Arguments to pass to the underlying instance.
   * @returns {ServerSpy} `this`.
   */
  close(...args) {
    this.#target.close(...args);
    return this;
  }

  /**
   * Standard {@link net.Server} method.
   *
   * @param {...*} args Arguments to pass to the underlying instance.
   * @returns {ServerSpy} `this`.
   */
  getConnections(...args) {
    this.#target.getConnections(...args);
    return this;
  }

  /**
   * Standard {@link net.Server} method.
   *
   * @param {...*} args Arguments to pass to the underlying instance.
   * @returns {ServerSpy} `this`.
   */
  listen(...args) {
    // The last argument might be a callback, and if it is, then we attach it
    // to this instance instead of the target.
    const lastArgIdx = args.length - 1;
    const callback = (typeof args[lastArgIdx] === 'function')
      ? args.pop()
      : null;

    this.#target.listen(...args);
    if (callback) {
      this.once('listening', callback);
    }

    return this;
  }

  /**
   * Standard {@link net.Server} method.
   *
   * @param {...*} args Arguments to pass to the underlying instance.
   * @returns {ServerSpy} `this`.
   */
  ref(...args) {
    this.#target.ref(...args);
    return this;
  }

  /**
   * Standard {@link net.Server} method.
   *
   * @param {...*} args Arguments to pass to the underlying instance.
   * @returns {ServerSpy} `this`.
   */
  unref(...args) {
    this.#target.unref(...args);
    return this;
  }

  /**
   * Handles the event `close` coming from the underlying instance.
   *
   * @param {...*} args Type-specific event arguments.
   */
  #handleClose(...args) {
    this.emit('close', ...args);
  }

  /**
   * Handles the event `connection` coming from the underlying instance.
   *
   * @param {...*} args Type-specific event arguments.
   */
  #handleConnection(...args) {
    if (this.#logger) {
      const socket = args[0];
      try {
        this.#logger.connectedFrom(socket.address());
      } catch (e) {
        this.#logger.weirdConnectionEvent(...args);
      }
    }

    // TODO: Wrap the socket!
    this.emit('connection', ...args);
  }

  /**
   * Handles the event `drop` coming from the underlying instance.
   *
   * @param {...*} args Type-specific event arguments.
   */
  #handleDrop(...args) {
    this.emit('drop', ...args);
  }

  /**
   * Handles the event `error` coming from the underlying instance.
   *
   * @param {...*} args Type-specific event arguments.
   */
  #handleError(...args) {
    this.emit('error', ...args);
  }

  /**
   * Handles the event `listening` coming from the underlying instance.
   *
   * @param {...*} args Type-specific event arguments.
   */
  #handleListening(...args) {
    this.emit('listening', ...args);
  }
}
