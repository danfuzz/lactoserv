// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration, Moment } from '@this/quant';
import { Methods } from '@this/typey';


/**
 * Interface for accessing and utilizing a source of time information.
 *
 * @interface
 */
export class IntfTimeSource {
  // @defaultConstructor

  /**
   * Gets the current time.
   *
   * @abstract
   * @returns {Moment} The current time.
   */
  now() {
    return Methods.abstract();
  }

  /**
   * Async-returns `null` after a specified amount of time, with the hope that
   * the actual time waited will be reasonably close to the request.
   *
   * **Note:** This is meant to be a time-source-specific replacement for the
   * various versions and bindings of `setTimeout()` provided by Node.
   *
   * @param {Duration} dur How much time to wait before this method is to
   *   async-return. If zero or negative, this method simply does not wait
   *   before returning.
   * @param {object} [options] Timeout options. This is the same as with
   *   `node:timers/promises.setTimeout()`.
   * @returns {null} `null`, always.
   */
  static async waitFor(dur, options = undefined) {
    return Methods.abstract(dur, options);
  }

  /**
   * Async-returns `null` when {@link #now} would return a value at or beyond
   * the given time, with the hope that the actual time will be reasonably
   * close.
   *
   * **Note:** Unlike `setTimeout()`, this method takes the actual time value,
   * not a duration.
   *
   * @abstract
   * @param {Moment} time The time after which this method is to async-return.
   * @returns {null} `null`, always.
   */
  async waitUntil(time) {
    return Methods.abstract(time);
  }
}
