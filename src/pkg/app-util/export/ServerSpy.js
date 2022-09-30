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

  /** @type {function(...*)} Logger to use. */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {net.Server|object} targetOrOptions Server to spy upon, or options
   *   for creation of a `net.Server`.
   * @param {function(...*)} logger Logger to use.
   */
  constructor(targetOrOptions, logger) {
    super();

    const target = (targetOrOptions instanceof net.Server)
      ? targetOrOptions
      : net.createServer(targetOrOptions);

    this.#target = target;
    this.#logger = logger;

    target.on('close',      (...args) => this.#handleClose(...args));
    target.on('connection', (...args) => this.#handleConnection(...args));
    target.on('error',      (...args) => this.#handleError(...args));
    target.on('listening',  (...args) => this.#handleListening(...args));
    target.on('drop',       (...args) => this.#handleDrop(...args));
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
      this.on('listening', callback);
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

    const socket = args[0];
    try {
      this.#logger.connectedFrom(socket.address());
    } catch (e) {
      this.#logger.weirdConnectionEvent(...args);
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
