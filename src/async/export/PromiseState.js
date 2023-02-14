// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';


/**
 * Utility class to synchronously inspect promise state. This is primarily
 * intended for use in unit and integration tests. (Really, it's almost
 * certainly a bad idea to use this in any other context.)
 */
export class PromiseState {
  /**
   * Gets the state of the given promise. Possible states are `fulfilled`
   * (resolved), `pending`, and `rejected`.
   *
   * @param {Promise} promise The promise in question.
   * @returns {string} Its state.
   * @throws {Error} Thrown if `promise` is not in fact a promise.
   */
  static of(promise) {
    const name = promise.constructor.name;

    // When using testing tools that instrument promises, the global `Promise`
    // might have been replaced with a subclass of the original `Promise`, and
    // `promise` here might be an original. On the other hand, we might actually
    // have a `promise` that's not "really" a `Promise` but which -- for the
    // purposes of testing -- is "close enough." So, we generously accept either
    // a straightforward `instanceof` _or_ something with a plausible-seeming
    // class name.
    if (!((promise instanceof Promise) || name.match(/Promise/))) {
      throw new Error('Not a promise.');
    }

    const str = util.inspect(promise, {
      breakLength:     Number.POSITIVE_INFINITY,
      compact:         true,
      customInspect:   false,
      depth:           0,
      maxStringLength: 0,
      showProxy:       false
    });

    // Use a tightly-matching regex when given a regular promise, and a more
    // loosey-goosey one when given a subclass. The latter can (and does)
    // happen, for example, when using testing tools that instrument promises.
    // Note: The use of `|()` guarantees that `str.match()` won't ever get an
    // error (it'll just successfully match nothing).
    const regex = (name === 'Promise')
      ? /^Promise \{ <(pending|rejected)>|()/
      : /^[^{]+[{][^<]+<(pending|rejected)>|()/;

    return str.match(regex)[1] ?? 'fulfilled';
  }

  /**
   * @param {Promise} promise The promise to investigate.
   * @returns {boolean} `true` iff its state is `fulfilled`.
   * @throws {Error} Thrown if `promise` is not in fact a promise.
   */
  static isFulfilled(promise) {
    return this.of(promise) === 'fulfilled';
  }

  /**
   * @param {Promise} promise The promise to investigate.
   * @returns {boolean} `true` iff its state is `pending`.
   * @throws {Error} Thrown if `promise` is not in fact a promise.
   */
  static isPending(promise) {
    return this.of(promise) === 'pending';
  }

  /**
   * @param {Promise} promise The promise to investigate.
   * @returns {boolean} `true` iff its state is `rejected`.
   * @throws {Error} Thrown if `promise` is not in fact a promise.
   */
  static isRejected(promise) {
    return this.of(promise) === 'rejected';
  }

  /**
   * @param {Promise} promise The promise to investigate.
   * @returns {boolean} `true` iff its state is _not_ `pending`.
   * @throws {Error} Thrown if `promise` is not in fact a promise.
   */
  static isSettled(promise) {
    return this.of(promise) !== 'pending';
  }
}
