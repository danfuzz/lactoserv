// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Server, Socket, createServer as netCreateServer } from 'node:net';
import * as timers from 'node:timers/promises';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
import { FormatUtils, IntfLogger } from '@this/loggy';

import { IntfRateLimiter } from '#x/IntfRateLimiter';
import { ProtocolWrangler } from '#x/ProtocolWrangler';


/**
 * Utility class for doing some of the lowest-level server socket manipulation.
 */
export class SocketUtil {
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
   * Gets the options for a constructor(ish) call, given the full server socket
   * `interface` options.
   *
   * @param {object} options The interface options.
   * @returns {object} The constructor-specific options.
   */
  static extractConstructorOptions(options) {
    return this.#fixOptions(options, this.#CREATE_PROTO);

  }

  /**
   * Gets the options for a `listen()` call, given the full server socket
   * `interface` options.
   *
   * @param {object} options The interface options.
   * @returns {object} The `listen()`-specific options.
   */
  static extractListenOptions(options) {
    return this.#fixOptions(options, this.#LISTEN_PROTO);
  }

  /**
   * Trims down and "fixes" `options` using the given prototype. This is used
   * to convert from our incoming `interface` form to what's expected by Node's
   * `Server` creation methods.
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
}
