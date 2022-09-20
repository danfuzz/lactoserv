// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as util from 'node:util';


/**
 * Utility class to synchronously inspect promise state. This is primarily
 * intended for use in unit and integration tests.
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
    if (!(promise instanceof Promise)) {
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

    // Note: `|()` guarantees that the match will succeed.
    return str.match(/^Promise \{ <(pending|rejected)>|()/)[1] ?? 'fulfilled';
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
