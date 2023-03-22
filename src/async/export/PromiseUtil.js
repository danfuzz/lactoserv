// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Miscellaneous promise utilities.
 */
export class PromiseUtil {
  /**
   * @type {WeakMap<object, {deferreds: Set<{resolve, reject}>, settled:
   * boolean}>} Weak map, which maps values passed to {@link #race} to the data
   * needed to resolve finished races involving those values.
   */
  static #raceMap = new WeakMap();

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

  /**
   * Non-memory-leaking version of `Promise.race()`. The code here is based on
   * an implementation by Brian Kim (first link below). See these bugs for more
   * details:
   *
   * * <https://github.com/nodejs/node/issues/17469#issuecomment-685216777>
   * * <https://bugs.chromium.org/p/v8/issues/detail?id=9858>
   *
   * @param {*[]} contenders Promises (or, degenerately, arbitrary objects) to
   *   race.
   * @returns {*} The resolved result from the first of `promises` to settle, if
   *   the first to settle becomes resolved.
   * @throws {*} The rejected result from the first of `promises` to settle, if
   *   the first to settle becomes rejected.
   */
  static race(contenders) {
    // This specific method body is covered by an "unlicense;" it is public
    // domain to the extent possible.

    const isPrimitive = (value) => {
      return (value === null)
        || ((typeof value !== 'object') && (typeof value !== 'function'));
    };

    let deferred;
    const result = new Promise((resolve, reject) => {
      deferred = { resolve, reject };
      for (const contender of contenders) {
        if (isPrimitive(contender)) {
          // If the contender is a primitive, attempting to use it as a key in
          // the weakmap would throw an error. Luckily, it is safe to call
          // `Promise.resolve(contender).then` on a primitive value multiple
          // times because the promise fulfills immediately.
          Promise.resolve(contender).then(resolve, reject);
          continue;
        }

        let record = this.#raceMap.get(contender);
        if (record === undefined) {
          record = { deferreds: new Set([deferred]), settled: false };
          this.#raceMap.set(contender, record);
          // This call to `then` happens once for the lifetime of the value.
          Promise.resolve(contender).then(
            (value) => {
              for (const { resolve: recordResolve } of record.deferreds) {
                recordResolve(value);
              }

              record.deferreds.clear();
              record.settled = true;
            },
            (err) => {
              for (const { reject: recordReject } of record.deferreds) {
                recordReject(err);
              }

              record.deferreds.clear();
              record.settled = true;
            },
          );
        } else if (record.settled) {
          // If the value has settled, it is safe to call
          // `Promise.resolve(contender).then` on it.
          Promise.resolve(contender).then(resolve, reject);
        } else {
          record.deferreds.add(deferred);
        }
      }
    });

    // The finally callback executes when any value settles, preventing any of
    // the unresolved values from retaining a reference to the resolved value.
    return result.finally(() => {
      for (const contender of contenders) {
        if (!isPrimitive(contender)) {
          const record = this.#raceMap.get(contender);
          record.deferreds.delete(deferred);
        }
      }
    });
  }
}
