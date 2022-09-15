// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * "Manually operated" promise, with client-accessible `resolve()` and
 * `reject()` methods, and synchronous accessors of state.
 */
export class ManualPromise {
  /** @type {Promise} The underlying promise. */
  #promise;

  /** @type {function(*)} The `resolve()` function. */
  #resolve;

  /** @type {function(*)} The `reject()` function. */
  #reject;

  /** @type {boolean} Has a rejection been handled? */
  #rejectionHandled = false;

  /**
   * @type {?({ fulfilled: true, value: * }|{ rejected: true, reason: * })} The
   * resolution, if the underlying promise has settled.
   */
  #resolution = null;

  /**
   * Constructs an instance.
   */
  constructor() {
    this.#promise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject  = reject;
    });
  }

  /**
   * @returns {*} The fulfilled value, if the promise is settled as fulfilled.
   * @throws {Error} Thrown if the promise is either unsettled or rejected.
   */
  get fulfilledValue() {
    if (this.isFulfilled()) {
      return this.#resolution.value;
    } else {
      throw new Error('Promise is not fulfilled.');
    }
  }

  /** @returns {Promise} The underlying promise. */
  get promise() {
    return this.#promise;
  }

  /**
   * In addition to getting the reason, this accessor also makes sure the system
   * considers the promise rejection "handled."
   *
   * @returns {*} The rejection reason, if the promise is settled as rejected.
   * @throws {Error} Thrown if the promise is either unsettled or fulfilled.
   */
  get rejectedReason() {
    if (this.isRejected()) {
      if (!this.#rejectionHandled) {
        this.#rejectionHandled = true;
        (async () => {
          try {
            await this.#promise;
          } catch {
            // Just swallow the exception, to convince Node not to complain
            // about this promise.
          }
        })();
      }
      return this.#resolution.reason;
    } else {
      throw new Error('Promise is not rejected.');
    }
  }

  /**
   * Gets an indicator of whether or not the underlying promise has been
   * settled as fulfilled.
   *
   * @returns {boolean} Whenter (`true`) or not (`false`) the underlying
   *   promise is settled as fulfilled.
   */
  isFulfilled() {
    return this.#resolution?.fulfilled ?? false;
  }

  /**
   * Gets an indicator of whether or not the underlying promise has been
   * settled as rejected.
   *
   * @returns {boolean} Whenter (`true`) or not (`false`) the underlying
   *   promise is settled as rejected.
   */
  isRejected() {
    return this.#resolution?.rejected ?? false;
  }

  /**
   * Gets an indicator of whether or not the underlying promise has been
   * settled (either as fulfilled or rejected).
   *
   * @returns {boolean} Whenter (`true`) or not (`false`) the underlying
   *   promise is settled.
   */
  isSettled() {
    return this.#resolution !== null;
  }

  /**
   * Rejects the underlying promise, with the given rejection reason.
   *
   * @param {*} reason The rejection reason.
   */
  reject(reason) {
    if (this.#resolution) {
      throw new Error('Cannot re-settled promise.');
    }

    this.#resolution = { rejected: true, reason };
    this.#reject(reason);
  }

  /**
   * Resolves the underlying promise, with the given result value.
   *
   * @param {*} value The resolved value.
   */
  resolve(value) {
    if (this.#resolution) {
      throw new Error('Cannot re-settled promise.');
    }

    this.#resolution = { fulfilled: true, value };
    this.#resolve(value);
  }
}
