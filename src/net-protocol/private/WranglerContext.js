// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import * as http2 from 'node:http2';
import * as net from 'node:net';
import * as stream from 'node:stream';

import { IntfLogger } from '@this/loggy-intf';

import { ProtocolWrangler } from '#x/ProtocolWrangler';


/**
 * Context that can be attached to the various objects that emerge from this
 * module, along with accessors to get at that context.
 */
export class WranglerContext {
  /**
   * Wrangler instance responsible for this context.
   *
   * @type {ProtocolWrangler}
   */
  #wrangler = null;

  /**
   * Unencrypted socket associated with a connection.
   *
   * @type {?net.Socket}
   */
  #socket = null;

  /**
   * ID of a connection.
   *
   * @type {?string}
   */
  #connectionId = null;

  /**
   * Logger for a connection.
   *
   * @type {?IntfLogger}
   */
  #connectionLogger = null;

  /**
   * ID of a session.
   *
   * @type {?string}
   */
  #sessionId = null;

  /**
   * Logger for a session.
   *
   * @type {?IntfLogger}
   */
  #sessionLogger = null;

  /**
   * Cached result for {@link #origin}, or `null` if not yet calculated.
   *
   * @type {?object}
   */
  #origin = null;

  /**
   * Constructs an instance.
   *
   * @param {WranglerContext} [source] Source instance to copy from, if any. If
   *   `null`, the new instance is empty.
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
  get origin() {
    if (!this.#origin) {
      const socket = this.#socket;
      if (socket) {
        this.#origin = {
          address: socket.remoteAddress,
          port:    socket.remotePort
        };
      } else {
        // Shouldn't happen in practice, but doing this is probably better than
        // throwing an error.
        this.logger?.unknownRemote(socket);
        this.#origin = { address: '<unknown>', port: 0 };
      }

      Object.freeze(this.#origin);
    }

    return this.#origin;
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

  /**
   * Binds the given object to this instance.
   *
   * @param {object} obj The object to bind from.
   */
  bind(obj) {
    WranglerContext.#CONTEXT_MAP.set(obj, this);
  }

  /**
   * Emits an event with an {@link AsyncLocalStorage} instance bound to this
   * instance, which can be recovered in follow-on event handlers by
   * {@link #currentInstance}.
   *
   * ### What's going on here?
   *
   * The layers of protocol implementation inside Node "conspire" to hide the
   * original socket of a `connection` event from the request and response
   * objects that ultimately get emitted as part of a `request` event, but we
   * want to actually be able to track a request back to the connection. This is
   * used in a few ways, including for recovering local-listener information
   * (see `IncomingRequest.host`) and logging. Node makes some effort to expose
   * "safe" socket operations through all the wrapped layers, but at least in
   * our use case (maybe because we ourselves wrap the raw socket, and that
   * messes with an `instanceof` check in the guts of Node's networking code)
   * the punch-through doesn't actually work.
   *
   * Thankfully, Node has an "async local storage" mechanism which is geared
   * towards exactly this sort of use case. By emitting the salient events with
   * an instance of this class as the designated "async storage," handlers for
   * downstream events can retrieve that same instance. Instead of exposing this
   * async storage stuff more widely, we use it tactically _just_ in this class,
   * in the hope that it won't leak out and make things confusing.
   *
   * @param {EventEmitter} emitter Event emitter to send from.
   * @param {string|symbol} eventName The event name.
   * @param {...*} args Arbitrary event arguments.
   * @returns {boolean} Standard result from {@link EventEmitter#emit}.
   */
  emitInContext(emitter, eventName, ...args) {
    const callback = () => emitter.emit(eventName, ...args);

    return WranglerContext.#perWranglerStorage.run(this, callback);
  }


  //
  // Static members
  //

  /**
   * Weak map from the "various objects" to instances of this class.
   *
   * @type {WeakMap<object, WranglerContext>}
   */
  static #CONTEXT_MAP = new WeakMap();

  /**
   * Async storage that can be bound to instances of this class, to enable
   * plumbing contexts through event chains that don't otherwise bear enough
   * information to recover the contexts.
   *
   * @type {AsyncLocalStorage}
   */
  static #perWranglerStorage = new AsyncLocalStorage();

  /**
   * @returns {WranglerContext} The instance that was bound most-closely by
   *   {@link #emitInContext}, if any.
   * @throws {Error} Thrown if there is no currently-bound instance.
   */
  static get currentInstance() {
    const ctx = this.#perWranglerStorage.getStore();

    if (!ctx) {
      throw new Error('No "current" context.');
    }

    return ctx;
  }

  /**
   * Binds an arbitrary external object to the {@link #currentInstance}.
   *
   * @param {object} obj The object to bind.
   */
  static bindCurrent(obj) {
    this.currentInstance.bind(obj);
  }

  /**
   * Makes a new instance of this class for a connection and {@link #bind}s it.
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

    ctx.bind(socket);

    return ctx;
  }

  /**
   * Makes a new instance of this class for a session, and {@link #bind}s it.
   *
   * @param {?WranglerContext} outerContext Instance of this class which has
   *   outer context (for the connection), if any.
   * @param {http2.ServerHttp2Session} session The session.
   * @param {?IntfLogger} logger The request logger, if any.
   * @returns {WranglerContext} An appropriately-constructed instance.
   */
  static forSession(outerContext, session, logger) {
    const ctx = new WranglerContext(outerContext);

    if (logger) {
      ctx.#sessionLogger = logger;
      ctx.#sessionId     = logger.$meta.lastContext;
    }

    ctx.bind(session);
    ctx.bind(session.socket);

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
