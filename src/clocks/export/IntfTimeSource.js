// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment } from '@this/data-values';
import { Methods } from '@this/typey';


/**
 * Interface for accessing and utilizing a source of time information.
 *
 * @interface
 */
export class IntfTimeSource {
  // Note: The default constructor is fine.

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
