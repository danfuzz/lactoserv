// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Miscellaneous promise utilities.
 */
export class PromiseUtil {
  /**
   * Causes a rejected promise to be considered "handled." Can be passed
   * anything; this does nothing (other than waste a little time) when given a
   * non-promise or a fulfilled promise.
   *
   * @param {*} maybePromise The promise in question.
   */
  static handleRejection(maybePromise) {
    (async () => {
      try {
        await maybePromise;
      } catch {
        // Ignore it.
      }
    })();
  }

  /**
   * Constructs a promise which is rejected but which is considered "already
   * handled."
   *
   * @param {Error} reason The rejection reason.
   * @returns {Promise} The appropriately-constructed pre-handled promise.
   */
  static rejectAndHandle(reason) {
    MustBe.instanceOf(reason, Error);

    const result = Promise.reject(reason);
    this.handleRejection(result);
    return result;
  }
}
