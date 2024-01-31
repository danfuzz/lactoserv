// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';
import * as stream from 'node:stream';

import { IntfLogger } from '@this/loggy';

import { ProtocolWrangler } from '#x/ProtocolWrangler';
import { Request } from '#x/Request';


/**
 * Context that can be attached to the various objects that emerge from this
 * module, along with accessors to get at that context.
 */
export class WranglerContext {
  /**
   * @type {ProtocolWrangler} Wrangler instance responsible for this context.
   */
  #wrangler = null;

  /** @type {?net.Socket} Unencrypted socket associated with a connection. */
  #socket = null;

  /** @type {?string} ID of a connection. */
  #connectionId = null;

  /** @type {?IntfLogger} Logger for a connection. */
  #connectionLogger = null;

  /** @type {?string} ID of a session. */
  #sessionId = null;

  /** @type {?IntfLogger} Logger for a session. */
  #sessionLogger = null;

  /** @type {?Request} Request. */
  #request = null;

  // Note: The default constructor is fine here.

  /** @returns {?string} ID of a connection. */
  get connectionId() {
    return this.#connectionId;
  }

  /** @returns {?IntfLogger} Logger for a connection, or `null` if none. */
  get connectionLogger() {
    return this.#connectionLogger;
  }

  /** @returns {?string} Most-specific available id, if any. */
  get id() {
    return this.requestId ?? this.#sessionId ?? this.#connectionId;
  }

  /** @returns {object} Plain object with all IDs in this context. */
  get ids() {
    const result = {};

    if (this.requestId)     result.requestId    = this.requestId;
    if (this.#sessionId)    result.sessionId    = this.#sessionId;
    if (this.#connectionId) result.connectionId = this.#connectionId;

    return result;
  }

  /** @returns {?IntfLogger} Most-specific available logger, if any. */
  get logger() {
    return this.requestLogger ?? this.#sessionLogger ?? this.#connectionLogger;
  }

  /** @returns {?Request} Request, if any. */
  get request() {
    return this.#request;
  }

  /** @returns {?string} ID of a request, if any. */
  get requestId() {
    return this.#request?.id;
  }

  /** @returns {?IntfLogger} Logger for a request, if any. */
  get requestLogger() {
    return this.#request?.logger;
  }

  /** @returns {?string} ID of a session. */
  get sessionId() {
    return this.#sessionId;
  }

  /** @returns {?IntfLogger} Logger for a session, or `null` if none. */
  get sessionLogger() {
    return this.#sessionLogger;
  }

  /**
   * @returns {?net.Socket|stream.Duplex} Unencrypted socket or socket-like
   * thing associated with a connection. If the connection has a data rate
   * limiter, this is the stream wrapper object which implements rate limiting.
   */
  get socket() {
    return this.#socket;
  }

  /**
   * @returns {ProtocolWrangler} Wrangler instance responsible for this context.
   */
  get wrangler() {
    return this.#wrangler;
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
   * @param {ProtocolWrangler} wrangler The wrangler instance which is managing
   *   the `socket`.
   * @param {net.Socket} socket The raw socket for the connection.
   * @param {?IntfLogger} logger The connection logger, if any.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forConnection(wrangler, socket, logger) {
    const ctx = new WranglerContext();

    ctx.#wrangler = wrangler;
    ctx.#socket   = socket;

    if (logger) {
      ctx.#connectionLogger = logger;
      ctx.#connectionId     = logger.$meta.lastContext;
    }

    return ctx;
  }

  /**
   * Makes a new instance of this class for a request.
   *
   * @param {?WranglerContext} outerContext Instance of this class which has
   *   outer context (for the connection and/or session), if any.
   * @param {Request} request The request.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forRequest(outerContext, request) {
    const ctx = new WranglerContext();

    if (outerContext) {
      ctx.#wrangler         = outerContext.#wrangler;
      ctx.#socket           = outerContext.#socket;
      ctx.#connectionLogger = outerContext.#connectionLogger;
      ctx.#connectionId     = outerContext.#connectionId;
      ctx.#sessionLogger    = outerContext.#sessionLogger;
      ctx.#sessionId        = outerContext.#sessionId;
    }

    ctx.#request = request;

    return ctx;
  }

  /**
   * Makes a new instance of this class for a session.
   *
   * @param {?WranglerContext} outerContext Instance of this class which has
   *   outer context (for the connection), if any.
   * @param {?IntfLogger} logger The request logger, if any.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forSession(outerContext, logger) {
    const ctx = new WranglerContext();

    if (outerContext) {
      ctx.#wrangler         = outerContext.#wrangler;
      ctx.#socket           = outerContext.#socket;
      ctx.#connectionLogger = outerContext.#connectionLogger;
      ctx.#connectionId     = outerContext.#connectionId;
    }

    if (logger) {
      ctx.#sessionLogger = logger;
      ctx.#sessionId     = logger.$meta.lastContext;
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

  /**
   * Like {@link #get}, but throws if an instance can't be found.
   *
   * @param {...object} objs The object(s) to look up.
   * @returns {WranglerContext} Instance of this class with salient context.
   * @throws {Error} Thrown if there is no such instance.
   */
  static getNonNull(...objs) {
    const found = this.get(...objs);

    if (!found) {
      throw new Error('Missing context.');
    }

    return found;
  }
}
