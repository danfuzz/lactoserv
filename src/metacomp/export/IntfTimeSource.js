// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';


/**
 * Interface for accessing a source of time information.
 *
 * @interface
 */
export class IntfTimeSource {
  // Note: The default constructor is fine.

  /**
   * Gets the current time, as a standard Unix Epoch time in seconds (_not_
   * milliseconds).
   *
   * @abstract
   * @returns {number} The current time.
   */
  nowSec() {
    return Methods.abstract();
  }

  /**
   * Async-returns `null` when {@link #nowSec} would return a value at or beyond
   * the given time, with the hope that the actual time will be reasonably
   * close.
   *
   * **Note:** Unlike `setTimeout()`, this method takes the actual time value,
   * not a duration.
   *
   * @abstract
   * @param {number} time The time after which this method is to async-return.
   * @returns {null} `null`, always.
   */
  async waitUntil(time) {
    return Methods.abstract(time);
  }
}
