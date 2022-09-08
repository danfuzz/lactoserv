// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * "Manually operated" promise, with client-accessible `resolve()` and
 * `reject()` methods.
 */
export class ManualPromise {
  /** @type {Promise} The underlying promise. */
  #promise;

  /** @type {function(*)} The `resolve()` function. */
  #resolve;

  /** @type {function(*)} The `reject()` function. */
  #reject;

  /**
   * Constructs an instance.
   */
  constructor() {
    this.#promise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject  = reject;
    });
  }

  /** @returns {Promise} The underlying promise. */
  get promise() {
    return this.#promise;
  }

  /**
   * Rejects the underlying promise, with the given rejection cause.
   *
   * @param {*} cause The rejection cause.
   */
  reject(cause) {
    this.#reject(cause);
  }

  /**
   * Resolves the underlying promise, with the given result value.
   *
   * @param {*} result The result value.
   */
  resolve(result) {
    this.#resolve(result);
  }
}
