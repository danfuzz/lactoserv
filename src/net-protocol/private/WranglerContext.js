// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';
import * as stream from 'node:stream';

import { IntfLogger } from '@this/loggy';

import { ProtocolWrangler } from '#x/ProtocolWrangler';


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

  /**
   * @type {?object} Result of {@link #remoteInfo}, or `null` if not yet
   * calculated.
   */
  #remoteInfo = null;

  /**
   * Constructs an instance.
   *
   * @param {WranglerContext} [source] Source instance to copy from, if any.
   *   If `null`, the new instance is empty.
   */
  constructor(source = null) {
    if (source) {
      this.#wrangler         = source.#wrangler;
      this.#socket           = source.#socket;
      this.#connectionId     = source.#connectionId;
      this.#connectionLogger = source.#connectionLogger;
      this.#sessionLogger    = source.#sessionLogger;
      this.#sessionId        = source.#sessionId;
    }
  }

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
    return this.#sessionId ?? this.#connectionId;
  }

  /** @returns {object} Plain object with all IDs in this context. */
  get ids() {
    const result = {};

    if (this.#sessionId)    result.sessionId    = this.#sessionId;
    if (this.#connectionId) result.connectionId = this.#connectionId;

    return result;
  }

  /** @returns {?IntfLogger} Most-specific available logger, if any. */
  get logger() {
    return this.#sessionLogger ?? this.#connectionLogger;
  }

  /**
   * @returns {object} Object representing the remote address/port of the
   * {@link #socket}. It is always a frozen object.
   */
  get remoteInfo() {
    if (!this.#remoteInfo) {
      const socket = this.#socket;
      if (socket) {
        this.#remoteInfo = {
          address: socket.remoteAddress,
          port:    socket.remotePort
        };
      } else {
        // Shouldn't happen in practice, but doing this is probably better than
        // throwing an error.
        this.logger?.unknownRemote(socket);
        this.#remoteInfo = { address: '<unknown>', port: 0 };
      }

      Object.freeze(this.#remoteInfo);
    }

    return this.#remoteInfo;
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
   * Makes a new instance of this class for a session.
   *
   * @param {?WranglerContext} outerContext Instance of this class which has
   *   outer context (for the connection), if any.
   * @param {?IntfLogger} logger The request logger, if any.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forSession(outerContext, logger) {
    const ctx = new WranglerContext(outerContext);

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
