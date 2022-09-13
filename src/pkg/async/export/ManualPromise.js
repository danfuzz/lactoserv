// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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

  /** @type {boolean} Has `#promise` settled? */
  #isSettled = false;

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
   * Gets an indicator of whether or not the underlying promise has been
   * settled (either as resolved or rejected).
   *
   * @returns {boolean} Whenter (`true`) or not (`false`) the underlying
   *   promise is settled.
   */
  isSettled() {
    return this.#isSettled;
  }

  /**
   * Rejects the underlying promise, with the given rejection cause.
   *
   * @param {*} cause The rejection cause.
   */
  reject(cause) {
    this.#isSettled = true;
    this.#reject(cause);
  }

  /**
   * Resolves the underlying promise, with the given result value.
   *
   * @param {*} result The result value.
   */
  resolve(result) {
    this.#isSettled = true;
    this.#resolve(result);
  }
}
