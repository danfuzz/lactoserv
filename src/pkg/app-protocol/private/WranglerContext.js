// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as net from 'node:net';

import { FormatUtils } from '@this/loggy';


/**
 * Context that can be attached to the various objects that emerge from this
 * module, along with accessors to get at that context.
 */
export class WranglerContext {
  /** @type {?net.Socket} Raw socket associated with a connection. */
  #socket = null;

  /** @type {?string} ID of a connection. */
  #connectionId = null;

  /** @type {?function(...*)} Logger for a connection. */
  #connectionLogger = null;

  /** @type {?string} ID of a request. */
  #requestId = null;

  /** @type {?function(...*)} Logger for a request. */
  #requestLogger = null;

  // Note: The default constructor is fine here.

  /** @returns {?string} ID of a connection. */
  get connectionId() {
    return this.#connectionId;
  }

  /** @returns {?function(...*)} Logger for a connection. */
  get connectionLogger() {
    return this.#connectionLogger;
  }

  /** @returns {?string} ID of a request. */
  get requestId() {
    return this.#requestId;
  }

  /** @returns {?function(...*)} Logger for a request. */
  get requestLogger() {
    return this.#requestLogger;
  }

  /** @returns {?net.Socket} Raw socket associated with a connection. */
  get socket() {
    return this.#socket;
  }

  /**
   * @returns {string} Loggable form of the remote address and port from the
   * {@link #socket}, if and as available.
   */
  get socketAddressPort() {
    const { remoteAddress, remotePort } = this.#socket ?? {};
    return FormatUtils.addressPortString(remoteAddress, remotePort);
  }


  //
  // Static members
  //

  /**
   * @type {WeakMap<object, WranglerContext>} Weak map from the "various
   * objects" to instances of this class.
   */
  static #CONTEXT_MAP = new WeakMap();

  /**
   * Binds an instance of this class to the given external related object.
   *
   * @param {object} obj The object to bind from.
   * @param {WranglerContext} context Instance of this class with salient
   *   context.
   */
  static bind(obj, context) {
    this.#CONTEXT_MAP.set(obj, context);
  }

  /**
   * Makes a new instance of this class for a connection.
   *
   * @param {net.Socket} socket The raw socket for the connection.
   * @param {?function(...*)} logger The connection logger, if any.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forConnection(socket, logger) {
    const ctx = new WranglerContext();

    ctx.#socket = socket;

    if (logger) {
      ctx.#connectionLogger = logger;
      ctx.#connectionId     = logger.$meta.lastContext;
    }

    return ctx;
  }

  /**
   * Makes a new instance of this class for a request.
   *
   * @param {?WranglerContext} connectionContext Instance of this class which
   *   has connection context, if any.
   * @param {?function(...*)} logger The request logger, if any.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forRequest(connectionContext, logger) {
    const ctx = new WranglerContext();

    if (connectionContext) {
      ctx.#socket           = connectionContext.#socket;
      ctx.#connectionLogger = connectionContext.#connectionLogger;
      ctx.#connectionId     = connectionContext.#connectionId;
    }

    if (logger) {
      ctx.#requestLogger = logger;
      ctx.#requestId     = logger.$meta.lastContext;
    }

    return ctx;
  }

  /**
   * Gets the instance of this class which was previously bound to one of the
   * given external related objects. If passed more than one object, the first
   * one (in argument order) to have a binding "wins."
   *
   * @param {...object} objs The object(s) to look up.
   * @returns {?WranglerContext} Instance of this class with salient context, if
   *   found.
   */
  static get(...objs) {
    for (const obj of objs) {
      const found = this.#CONTEXT_MAP.get(obj);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
