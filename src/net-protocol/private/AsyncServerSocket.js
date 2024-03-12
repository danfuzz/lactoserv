// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Server, createServer as netCreateServer } from 'node:net';

import lodash from 'lodash';

import { EventPayload, EventSource, LinkedEvent, PromiseUtil }
  from '@this/async';
import { WallClock } from '@this/clocks';
import { IntfLogger } from '@this/loggy';
import { FormatUtils } from '@this/loggy-intf';
import { MustBe } from '@this/typey';


/**
 * Utility class for doing some of the lowest-level server socket manipulation,
 * in a way that is `async`-friendly.
 */
export class AsyncServerSocket {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /** @type {object} Parsed server socket `interface` specification. */
  #interface;

  /** @type {string} The protocol name; just used for logging. */
  #protocol;

  /**
   * @type {?Server} The underlying server socket instance (Node library class),
   * if constructed.
   */
  #serverSocket = null;

  /**
   * @type {function()} Function to call to remove all of the listeners on
   * {@link #serverSocket}.
   */
  #removeListenersFunc = null;

  /** @type {EventSource} Event source for `connection` and `drop` events. */
  #eventSource = new EventSource();

  /**
   * @type {Promise<LinkedEvent>} Promise for the next event which will need
   * action.
   */
  #eventHead = this.#eventSource.earliestEvent;

  /**
   * Constructs an instance.
   *
   * @param {object} iface Parsed server socket `interface` specification.
   * @param {string} protocol The protocol name; just used for logging.
   * @param {?IntfLogger} logger Logger to use, if any.
   */
  constructor(iface, protocol, logger) {
    // Note: `interface` is a reserved word.
    this.#interface = MustBe.plainObject(iface);
    this.#protocol  = MustBe.string(protocol);
    this.#logger    = logger;
  }

  /**
   * @returns {object} Loggable info about this instance, including interface
   * address and current-listening info.
   */
  get loggableInfo() {
    const address = this.#serverSocket?.address();
    const iface   = FormatUtils.networkInterfaceString(this.#interface);

    return {
      protocol:  this.#protocol,
      interface: iface,
      ...(address
        ? { listening: FormatUtils.networkInterfaceString(address) }
        : {})
    };
  }

  /**
   * Accepts a connection from the underlying server socket, with optional
   * cancellation. If not canceled, this returns an event payload in one of
   * these forms, analogous to the events defined by {@link Server}:
   *
   * * `{ type: 'connection', args: [socket] }`
   * * `{ type: 'drop', args: [<drop data>] }`
   *
   * @param {?Promise} [cancelPromise] If non-`null` a promise which
   *   cancels this request when settled (either fulfilled or rejected).
   * @returns {?EventPayload} Event payload as described above, or `null` if the
   *  `cancelPromise` became settled.
   */
  async accept(cancelPromise = null) {
    const result = cancelPromise
      ? await PromiseUtil.race([this.#eventHead, cancelPromise])
      : await this.#eventHead;

    if (this.#eventSource.isLinkedFrom(result)) {
      // _Not_ canceled. Note: We use `isLinkedFrom()` instead of just an
      // `instanceof` check, because we don't want to rely on `cancelPromise`
      // _not_ resolving to a `LinkedEvent` (even though that's the status quo
      // as of this writing).
      this.#eventHead = result.nextPromise;
      return result.payload;
    } else {
      // Canceled.
      return null;
    }
  }

  /**
   * Starts this instance.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async start(isReload) {
    MustBe.boolean(isReload);

    // In case of a reload, look for a stashed instance which is already set up
    // the same way.
    const found = isReload
      ? AsyncServerSocket.#unstashInstance(this.#interface)
      : null;

    if (found?.#serverSocket) {
      // Inherit the "guts" of the now-unstashed instance.
      this.#serverSocket = found.#serverSocket;
      found.#removeListenersFunc();

      // Transfer any unhandled events to the new instance.
      found.#eventSource.emit(new EventPayload('done'));
      let eventHead = await found.#eventHead;
      while (eventHead) {
        if (eventHead.type === 'done') {
          break;
        }
        this.emit(eventHead.payload);
        eventHead = eventHead.nextNow;
      }
    } else {
      // Either this isn't a reload, or it's a reload with an endpoint that
      // isn't configured the same way as one of the pre-reload ones, or it's a
      // reload but the found instance didn't actually have a socket.
      this.#serverSocket = netCreateServer(
        AsyncServerSocket.#extractConstructorOptions(this.#interface));
    }

    const onConnection = (...args) => {
      this.#eventSource.emit(new EventPayload('connection', ...args));
    };

    const onDrop = (...args) => {
      this.#eventSource.emit(new EventPayload('drop', ...args));
    };

    this.#serverSocket.on('connection', onConnection);
    this.#serverSocket.on('drop', onDrop);

    this.#removeListenersFunc = () => {
      this.#serverSocket.removeListener('connection', onConnection);
      this.#serverSocket.removeListener('drop',       onDrop);
    };

    await this.#listen();
  }

  /**
   * Stops this this instance. This method returns when the instance is fully
   * stopped.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload) {
    MustBe.boolean(willReload);

    if (willReload) {
      AsyncServerSocket.#stashInstance(this);
    } else {
      await this.#close();
    }
  }

  /**
   * Performs a `close()` on the underlying {@link Server}, unless it is already
   * closed in which case this method does nothing. This method async-returns
   * once the server has actually stopped listening for connections.
   */
  async #close() {
    const serverSocket = this.#serverSocket;

    if (!serverSocket.listening) {
      // Apparently already closed.
      return;
    }

    serverSocket.close();

    // Wait for the server to claim to have stopped.
    while (serverSocket.listening) {
      await new Promise((resolve, reject) => {
        function done(err) {
          serverSocket.removeListener('close', handleClose);
          serverSocket.removeListener('error', handleError);

          if (err !== null) {
            reject(err);
          } else {
            resolve();
          }
        }

        function handleClose() {
          done(null);
        }

        function handleError(err) {
          done(err);
        }

        serverSocket.on('close', handleClose);
        serverSocket.on('error', handleError);
      });
    }

    // Close any sockets that happened to have been accepted in this class but
    // which weren't then passed on to a client.
    // Transfer any unhandled events to the new instance.
    this.#eventSource.emit(new EventPayload('done'));
    let eventHead = await this.#eventHead;
    while (eventHead) {
      if (eventHead.type === 'done') {
        break;
      } else if (eventHead.type === 'connection') {
        const socket = eventHead.args[0];
        socket.destroy();
      }
      eventHead = eventHead.nextNow;
    }
  }

  /**
   * Performs a `listen()` on the underlying {@link Server}, if not already
   * done. This method async-returns once the server is actually listening.
   */
  async #listen() {
    const serverSocket = this.#serverSocket;

    if (serverSocket.listening) {
      return;
    }

    // This `await new Promise` arrangement is done to get the `listen()` call
    // to be a good async citizen. Notably, the optional callback passed to
    // `listen()` is only ever sent a single `listening` event upon success and
    // never anything in case of an error.
    await new Promise((resolve, reject) => {
      function done(err) {
        serverSocket.removeListener('listening', handleListening);
        serverSocket.removeListener('error',     handleError);

        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      }

      function handleListening() {
        done(null);
      }

      function handleError(err) {
        done(err);
      }

      serverSocket.on('listening', handleListening);
      serverSocket.on('error',     handleError);

      serverSocket.listen(AsyncServerSocket.#extractListenOptions(this.#interface));
    });
  }

  //
  // Static members
  //

  /**
   * @type {object} "Prototype" of server socket creation options. See
   * `ProtocolWrangler` class doc for details.
   */
  static #CREATE_PROTO = Object.freeze({
    allowHalfOpen:         { default: true },
    keepAlive:             null,
    keepAliveInitialDelay: null,
    noDelay:               null,
    pauseOnConnect:        null
  });

  /**
   * @type {object} "Prototype" of server listen options. See `ProtocolWrangler`
   * class doc for details.
   */
  static #LISTEN_PROTO = Object.freeze({
    address:   { map: (v) => ({ host: (v === '*') ? '::' : v }) },
    backlog:   null,
    exclusive: null,
    fd:        null,
    port:      null
  });

  /**
   * @type {number} How long in msec to allow a stashed instance to remain
   * stashed.
   */
  static #STASH_TIMEOUT_MSEC = 5 * 1000;

  /**
   * @type {Set<AsyncServerSocket>} Set of stashed instances, for use during a
   * reload. Such instances were left open and listening during a previous
   * call to {@link #stop}.
   */
  static #stashedInstances = new Set();

  /**
   * Gets the options for a `Server` constructor(ish) call, given the full
   * server socket `interface` options.
   *
   * @param {object} options The interface options.
   * @returns {object} The constructor-specific options.
   */
  static #extractConstructorOptions(options) {
    return this.#fixOptions(options, this.#CREATE_PROTO);
  }

  /**
   * Gets the options for a `listen()` call, given the full server socket
   * `interface` options.
   *
   * @param {object} options The interface options.
   * @returns {object} The `listen()`-specific options.
   */
  static #extractListenOptions(options) {
    return this.#fixOptions(options, this.#LISTEN_PROTO);
  }

  /**
   * Trims down and "fixes" `options` using the given prototype. This is used
   * to convert from our incoming `interface` form to what's expected by Node's
   * `Server` construction and `listen()` methods.
   *
   * @param {object} options Original options.
   * @param {object} proto The "prototype" for what bindings to keep.
   * @returns {object} Pared down version.
   */
  static #fixOptions(options, proto) {
    const result = {};

    for (const [name, mod] of Object.entries(proto)) {
      const value = options[name];
      if (value === undefined) {
        if (mod?.default !== undefined) {
          result[name] = mod.default;
        }
      } else if (mod?.map) {
        Object.assign(result, (mod.map)(options[name]));
      } else {
        result[name] = options[name];
      }
    }

    return result;
  }

  /**
   * Stashes an instance for possible reuse during a reload.
   *
   * @param {AsyncServerSocket} instance The instance to stash.
   */
  static #stashInstance(instance) {
    // Remove any pre-existing matching instance. This shouldn't happen in the
    // first place, but if it does this will minimize the downstream confusion.
    this.#unstashInstance(instance.#interface);

    this.#stashedInstances.add(instance);
    instance.#logger?.stashed();

    (async () => {
      await WallClock.waitForMsec(this.#STASH_TIMEOUT_MSEC);
      if (this.#stashedInstances.delete(instance)) {
        instance.#logger?.stashTimeout();
        await instance.#close();
      }
    })();
  }

  /**
   * Finds a matching instance of this class, if any, which was stashed away
   * during a reload. If found, it is removed from the stash.
   *
   * @param {object} iface The interface specification for the instance.
   * @returns {?AsyncServerSocket} The found instance, if any.
   */
  static #unstashInstance(iface) {
    let found = null;
    for (const si of this.#stashedInstances) {
      if (lodash.isEqual(iface, si.#interface)) {
        found = si;
        break;
      }
    }

    if (found) {
      this.#stashedInstances.delete(found);
      found.#logger?.unstashed();
    }

    return found;
  }
}
