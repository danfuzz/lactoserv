// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { Methods, MustBe } from '@this/typey';

import { ManualPromise } from '#x/ManualPromise';
import { Threadlet } from '#x/Threadlet';


/**
 * Implementation of the "token bucket" algorithm, which is more or less
 * equivalent to the "leaky bucket as meter" algorithm (though with a different
 * metaphor). That is, this class provides a rate-limiter-with-burstiness
 * service.
 *
 * Unlike the "pure" token bucket as described in the literature, this
 * implementation provides a contention-handling mechanism on top of the basic
 * bucket service. In particular, it implements a configurable-size service
 * queue for clients waiting for tokens.
 *
 * This class defines neither the token (bucket volume) units nor the time
 * units. It is up to clients to use whatever makes sense in their context.
 */
export class TokenBucket {
  /**
   * Note: Though the constructor option is called `burstSize`, in the guts of
   * the implementation, it makes more sense to think of it as the bucket
   * capacity, which is why the internal property name is `capacity`.
   *
   * @type {number} Bucket capacity -- that is, maximum possible instantaneous
   * burst size -- in tokens.
   */
  #capacity;

  /**
   * @type {number} Token flow rate (a/k/a bucket fill rate), in tokens per
   * arbitrary time unit (tokens / ATU).
   */
  #flowRate;

  /** @type {number} Maximum grant size, in tokens. */
  #maxGrantSize;

  /**
   * @type {number} The maximum number of waiters that are allowed to be
   * waiting for a token grant. `Number.POSITIVE_INFINITY` is used represent "no
   * limit."
   */
  #maxWaiters;

  /** @type {boolean} Provide partial (non-integral / fractional) tokens? */
  #partialTokens;

  /** @type {TokenBucket.BaseTimeSource} Time measurement implementation. */
  #timeSource;

  /** @type {number} Most recently measured time. */
  #lastNow;

  /**
   * @type {number} The volume in the bucket at time {@link #lastNow), in
   * tokens.
   */
  #lastVolume;

  /**
   * @type {{ minInclusive: number, maxInclusive: number, startTime: number,
   * doGrant: function(number) }[]} Array of grant waiters.
   */
  #waiters = [];

  /**
   * @type {number} The sum of `.#waiters[*].minInclusive`, that is, how many
   * tokens must be granted to clear out the waiters.
   */
  #minTokensAwaited = 0;

  /** @type {Threadlet} Servicer thread for the {@link #waiters}. */
  #waiterThread = new Threadlet(() => this.#serviceWaiters());

  /**
   * Constructs an instance. Configuration options:
   *
   * * `{number} burstSize` -- Maximum possible instantaneous burst size (that
   *   is, the total bucket capacity), in tokens (arbitrary volume units). This
   *   defines the "burstiness" allowed by the instance. Must be a finite
   *   positive number. This is a required "option."
   * * `{number} flowRate` -- Token flow rate (a/k/a bucket fill rate), that is,
   *   how quickly the bucket gets filled, in tokens per arbitrary time unit
   *   (tokens / ATU). This defines the steady state "flow rate" allowed by the
   *   instance. Must be a finite positive number. This is a required "option."
   * * `{number} initialBurst` -- The instantaneously available burst size, in
   *   tokens, at the moment of construction. Defaults to `burstSize` (that is,
   *   able to be maximally "bursted" from the get-go).
   * * `{number} maxGrantSize` -- Maximum (atomic) grant size, in tokens. No
   *   grant requests will ever return a larger grant, even if there is
   *   available "burst volume" to accommodate it. Must be a finite positive
   *   number less than or equal to `burstSize`. Defaults to `burstSize`.
   * * `{?number} maxWaiters` -- The maximum number of waiters that are allowed
   *   to be waiting for a token grant (see {@link #requestGrant}). Must be a
   *   finite whole number or `null`. If not present or `null`, then there is no
   *   limit on waiters.
   * * `{boolean} partialTokens` -- If `true`, allows the instance to provide
   *   partial tokens (e.g. give a client `1.25` tokens). If `false`, all token
   *   handoffs from the instance are quantized to integer values. Defaults to
   *   `false`.
   * * `{TokenBucket.BaseTimeSource} timeSource` -- What to use to determine the
   *   passage of time. If not specified, the instance will use a standard
   *   implementation which measures time in seconds (_not_ msec) and bottoms
   *   out at the usual JavaScript / Node wall time interface (e.g.
   *   `Date.now()`, `timers.setTimeout()`).
   *
   * @param {object} options Configuration options, per the above description.
   */
  constructor(options) {
    const {
      burstSize, // See note above on property `#capacity`.
      flowRate,
      initialBurst  = options.burstSize,
      maxGrantSize  = options.burstSize,
      maxWaiters    = null,
      partialTokens = false,
      timeSource    = TokenBucket.#DEFAULT_TIME_SOURCE
    } = options;

    this.#capacity      = MustBe.number(burstSize, { finite: true, minExclusive: 0 });
    this.#flowRate      = MustBe.number(flowRate, { finite: true, minExclusive: 0 });
    this.#maxGrantSize  = MustBe.number(maxGrantSize, { minExclusive: 0, maxInclusive: burstSize });
    this.#partialTokens = MustBe.boolean(partialTokens);
    this.#timeSource    = MustBe.object(timeSource, TokenBucket.TimeSource);

    this.#maxWaiters = (maxWaiters === null)
      ? Number.POSITIVE_INFINITY
      : MustBe.number(maxWaiters, { safeInteger: true, minInclusive: 0 });

    this.#lastVolume = MustBe.number(initialBurst, { minInclusive: 0, maxInclusive: burstSize });
    this.#lastNow    = this.#timeSource.now();
  }

  /**
   * Denies grant requests for all current waiters, clearing the waiters queue.
   * This is useful when trying to cleanly shut down the service which this
   * instance is associated with. This method async-returns once all denials
   * have been processed.
   */
  async denyAllRequests() {
    if (this.#waiters.length !== 0) {
      await this.#waiterThread.stop();
    }
  }

  /**
   * Requests a grant of a particular quantity (or quantity range) of tokens, to
   * be granted all at once. This method async-returns either when the grant has
   * been made _or_ when the instance determines that it cannot perform the
   * grant due to its configured limits.
   *
   * This method returns an object with bindings as follows:
   *
   * * `{boolean} done` -- `true` if the grant was actually made. This can be
   *   be `true` even if `grant === 0`, in the case where the minimum requested
   *   grant is in fact `0`.
   * * `{number} grant` -- The quantity of tokens granted to the caller. This is
   *   `0` if the minimum required grant cannot be made.
   * * `{number} waitTime` -- The amount of time (in ATU) that was spent waiting
   *   for the grant.
   * * `{number} waitTimeUnit` -- The unit name for the units reported in
   *   `waitTime`.
   *
   * **Note:** It is invalid to use this method to request a grant with a
   * minimum size larger than the instance's configured `burstSize`.
   *
   * @param {number|object} quantity Requested quantity of tokens, as described
   *   in {@link #takeNow}.
   * @returns {number} Number of tokens actually granted (might be `0`).
   */
  async requestGrant(quantity) {
    const { minInclusive, maxInclusive } = this.#parseQuantity(quantity);

    if (this.#waiters.length === 0) {
      // No waiters right now, so try to get the grant synchronously.
      this.#topUpBucket();
      const got = this.#grantNow(minInclusive, maxInclusive);
      if (got.done) {
        return this.#requestGrantResult(true, got.grant, 0);
      }
    } else if (this.#waiters.length >= this.#maxWaiters) {
      // Too many waiters, per configuration.
      return this.#requestGrantResult(false, 0, 0);
    }

    const mp = new ManualPromise();

    this.#minTokensAwaited += minInclusive;
    this.#waiters.push({
      minInclusive,
      maxInclusive,
      startTime:    this.#lastNow,
      doGrant:      v => mp.resolve(v)
    });
    this.#waiterThread.start(); // Note: Does nothing if it's already running.

    return mp.promise;
  }

  /**
   * Gets an instantaneously-current snapshot of this instance, including
   * configuration info. The return value is an object with the following
   * bindings:
   *
   * * Timely info:
   *   * `{number} availableBurst` -- The currently-available burst size, that
   *     is, the quantity of tokens currently in the bucket.
   *   * `{number} now` -- The time as of the snapshot, according to this
   *     instance's time source.
   *   * `{number} waiters` -- The number of clients awaiting a token grant.
   * * Configuration info (same names as passed in the constructor, except as
   *   noted):
   *   * `{number} burstSize`
   *   * `{number} flowRate`
   *   * `{number} maxGrantSize`
   *   * `{number} maxWaiters`
   *   * `{boolean} partialTokens`
   *   * `{string} timeUnit` -- Name of the unit which this instance's time
   *     source uses.
   *
   * @returns {object} Snapshot, as described above.
   */
  snapshotNow() {
    this.#topUpBucket();

    const maxWaiters = (this.#maxWaiters === Number.POSITIVE_INFINITY)
      ? null
      : this.#maxWaiters;

    return {
      // Timely info.
      availableBurst: this.#lastVolume,
      now:            this.#lastNow,
      waiters:        this.#waiters.length,
      // Configuration info.
      burstSize:      this.#capacity,
      flowRate:       this.#flowRate,
      maxGrantSize:   this.#maxGrantSize,
      maxWaiters,
      partialTokens:  this.#partialTokens,
      timeUnit:       this.#timeSource.unitName
    };
  }

  /**
   * Instantaneously takes as many tokens as allowed, within the specified
   * range. This method accepts either an exact number of tokens to request or
   * an object as follows:
   *
   * * `{number} minInclusive` -- Minimum quantity of tokens to be granted. If
   *   the minimum can't be met, then the call will grant no (`0`) tokens.
   *   Defaults to `0`. Invalid if negative or larger than this instance's
   *   `burstSize`. If this instance was constructed with `partialTokens ===
   *   false`, then it is rounded up (`Math.ceil()`) when not a whole number.
   * * `{number} maxInclusive` -- Maximum quantity of tokens to be granted.
   *   Defaults to `0`. Invalid if negative, and clamped at `minInclusive`. If
   *   If this instance was constructed with `partialTokens === false`, then it
   *   is rounded down (`Math.floor()`) when not a whole number.
   *
   * This method returns an object with bindings as follows:
   *
   * * `{boolean} done` -- `true` if the grant is considered complete. This can
   *   be `true` even if `grant === 0`, in the case where the minimum requested
   *   grant is in fact `0`.
   * * `{number} grant` -- The quantity of tokens granted to the caller. This is
   *   `0` if the minimum required grant cannot be made.
   * * `{number} minWaitTime` -- The amount of time needed to wait (in ATU) in
   *   order to possibly be granted the minimum requested quantity of tokens.
   *   This is only non-zero if `done === false`.
   * * `{number} maxWaitTime` -- The amount of time needed to wait (in ATU) in
   *   order to possibly be granted the maximum requested quantity of tokens.
   * * `{number} waitTimeUnit` -- The unit name for the units reported in
   *   `*WaitTime`.
   *
   * If the `minInclusive` request is non-zero, then this method will only ever
   * return `done === true` if there is no immediate contention for tokens
   * (e.g., due to async-active calls to {@link #requestGrant}). The resulting
   * `minWaitTime` and `maxWaitTime` do take active contention into account,
   * though the actual required wait times can turn out to be larger than what
   * was returned.
   *
   * Note: This method _first_ tops up the token bucket based on the amount of
   * time elapsed since the previous top-up, and _then_ removes tokens. This
   * means (a) that it's never possible to take more tokens than the total
   * `burstSize`, and (b) it is possible to totally empty the bucket with a call
   * to this method.
   *
   * @param {number|object} quantity Requested quantity of tokens, as described
   *   above.
   * @returns {object} Result object as described above.
   * @throws {Error} Thrown if the request is invalid (inverted range,
   *   `minInclusive` is more than the `burstSize`, etc.).
   */
  takeNow(quantity) {
    const { minInclusive, maxInclusive } = this.#parseQuantity(quantity);

    this.#topUpBucket();

    const result     = this.#grantNow(minInclusive, maxInclusive);
    const waiterTime = this.#minTokensAwaited / this.#flowRate;

    result.waitTimeUnit = this.#timeSource.unitName;
    result.maxWaitTime += waiterTime;

    if (!result.done) {
      result.minWaitTime += waiterTime;
    }

    return result;
  }

  /**
   * Async-returns after a specified amount of time has passed, using the
   * units defined by this instance's time source.
   *
   * @param {number} waitTime The amount of time to wait, in ATU.
   */
  async wait(waitTime) {
    if (waitTime > 0) {
      await this.#timeSource.setTimeout(waitTime);
    }
  }

  /**
   * Helper for token-grant methods, which calculates an actual grant quantity.
   *
   * @param {number} minInclusive The minimum quantity of tokens to be granted.
   * @param {number} maxInclusive The maximum quantity of tokens to be granted.
   * @returns {number} The actual grant amount.
   */
  #calculateGrant(minInclusive, maxInclusive) {
    const availableVolume = this.#partialTokens
      ? this.#lastVolume
      : Math.floor(this.#lastVolume);

    if (availableVolume < minInclusive) {
      return 0;
    } else if (availableVolume < maxInclusive) {
      return availableVolume;
    } else {
      return maxInclusive;
    }
  }

  /**
   * Token grant helper, which implements the core functionality of {@link
   * #takeNow} and is used by other token-granting methods. Notably:
   *
   * * It assumes its arguments are valid, including (effectively) being
   *   processed by {@link #parseQuantity}.
   * * It does _not_ top up the bucket before taking action.
   * * It does not take into account any waiters, including the calculation of
   *   the returned wait times. (This is the method used to actually grant
   *   tokens on behalf of waiters!)
   *
   * This method returns an object with the following binding, which all have
   * the same meaning as with {@link #takeNow}: `done`, `grant`, `maxWaitTime`,
   * and `minWaitTime`.
   *
   * @param {number} minInclusive Minimum requested quantity of tokens.
   * @param {number} maxInclusive Maximum requested quantity of tokens.
   * @returns {object} Grant result, as described above.
   */
  #grantNow(minInclusive, maxInclusive) {
    const grant     = this.#calculateGrant(minInclusive, maxInclusive);
    const newVolume = this.#lastVolume - grant;
    const done      = (grant !== 0) || (minInclusive === 0);

    // The wait times take into account any tokens which remain in the bucket
    // after a partial grant.
    const neededMax   = Math.max(0, (maxInclusive - grant) - newVolume);
    const neededMin   = Math.max(0, (minInclusive - grant) - newVolume);
    const maxWaitTime = neededMax / this.#flowRate;
    const minWaitTime = neededMin / this.#flowRate;

    this.#lastVolume = newVolume;
    return { done, grant, maxWaitTime, minWaitTime };
  }

  /**
   * Helper for `take*()` methods, which parses, adjusts, and and does validity
   * checking on a `quantity` argument.
   *
   * @param {object|number} quantity The requested quantity, as described by
   *   `take*()`.
   * @returns {function(number): number} Replacement arguments.
   * @throws {Error} Thrown if there is trouble with the arguments.
   */
  #parseQuantity(quantity) {
    let minInclusive;
    let maxInclusive;

    if (typeof quantity === 'number') {
      minInclusive = quantity;
      maxInclusive = quantity;
    } else {
      ({ maxInclusive = 0, minInclusive = 0 } = quantity);
    }

    if (!this.#partialTokens) {
      maxInclusive = Math.floor(maxInclusive);
      minInclusive = Math.ceil(minInclusive);
    }

    try {
      MustBe.number(minInclusive, { minInclusive: 0, maxInclusive: this.#capacity });
      MustBe.number(maxInclusive, { minInclusive: 0 });
    } catch (e) {
      throw new Error(`Impossible take request: ${minInclusive}..${maxInclusive}, burst size ${this.#capacity}`);
    }

    if (maxInclusive < minInclusive) {
      maxInclusive = minInclusive;
    }

    return { minInclusive, maxInclusive };
  }

  /**
   * Produces a result for a call to {@link #requestGrant}.
   *
   * @param {boolean} done Done?
   * @param {number} grant Grant amount.
   * @param {number} waitTime Amount of time spent waiting.
   * @returns {object} An appropriately-constructed result.
   */
  #requestGrantResult(done, grant, waitTime) {
    return {
      done,
      grant,
      waitTime,
      waitTimeUnit: this.#timeSource.unitName
    };
  }

  /**
   * Services {@link #waiters}. This gets run in {@link #waiterThread} whenever
   * {@link #waiters} is non-empty, and stops once it becomes empty.
   */
  async #serviceWaiters() {
    while (!this.#waiterThread.shouldStop()) {
      const info = this.#waiters[0];
      if (!info) {
        break;
      }

      this.#topUpBucket();
      const got = this.#grantNow(info.minInclusive, info.maxInclusive);

      if (got.done) {
        this.#waiters.shift();
        this.#minTokensAwaited -= info.minInclusive;
        const waitTime = this.#lastNow - info.startTime;
        info.doGrant(this.#requestGrantResult(true, got.grant, waitTime));
      } else {
        await Promise.race([
          this.wait(got.minWaitTime),
          this.#waiterThread.whenStopRequested()
        ]);
      }
    }

    if (this.#waiterThread.shouldStop()) {
      // The thread was asked to stop, which only happens in this class when
      // `denyAllRequests()` was called. So, deny all requests.
      for (const info of this.#waiters) {
        const waitTime = this.#lastNow - info.startTime;
        info.doGrant(this.#requestGrantResult(false, 0, waitTime));
      }

      this.#waiters = [];
    }
  }

  /**
   * Tops up the bucket, based on how much time has elapsed since the last
   * topping-up.
   */
  #topUpBucket() {
    const now        = this.#timeSource.now();
    const lastVolume = this.#lastVolume;

    if (lastVolume < this.#capacity) {
      const elapsedTime = now - this.#lastNow;
      const grant       = elapsedTime * this.#flowRate;
      this.#lastVolume  = Math.min(lastVolume + grant, this.#capacity);
    }

    this.#lastNow = now;
  }


  //
  // Static members
  //

  /** @type {TokenBucket.StdTimeSource} Default time source. */
  static #DEFAULT_TIME_SOURCE;

  /**
   * Base class for time sources used by instances of this (outer) class.
   */
  static BaseTimeSource = class BaseTimeSource {
    // Note: The default constructor is fine.

    /** @returns {string} The name of the unit which this instance uses. */
    get unitName() {
      return Methods.abstract();
    }

    /**
     * Gets the current time, in arbitrary time units (ATU) which have elapsed
     * since an arbitrary base time.
     *
     * @abstract
     * @returns {number} The current time.
     */
    now() {
      return Methods.abstract();
    }

    /**
     * Async-returns the given value after the given number of arbitrary time
     * units (ATU) have elapsed.
     *
     * @abstract
     * @param {number} delay The number of ATU that must elapse before
     *   async-returning.
     * @param {*} [value = null] Value to return.
     * @returns {*} `value`, after `delay` ATU have elapsed.
     */
    async setTimeout(delay, value = null) {
      return Methods.abstract(delay, value);
    }
  };

  /**
   * Standard implementation of {@link #BaseTimeSource}, which uses "wall time"
   * as provided by the JavaScript / Node implementation, and for which the ATU
   * is actually a second (_not_ a msec).
   */
  static StdTimeSource = class StdTimeSource extends this.BaseTimeSource {
    // Note: The default constructor is fine.

    /** @override */
    get unitName() {
      return 'seconds';
    }

    /** @override */
    now() {
      return Date.now() * StdTimeSource.#SECS_PER_MSEC;
    }

    /** @override */
    async setTimeout(delay, value = null) {
      const delayMsec = delay * StdTimeSource.#MSEC_PER_SEC;
      return timers.setTimeout(delayMsec, value);
    }

    /** {number} The number of milliseconds in a second. */
    static #MSEC_PER_SEC = 1000;

    /** {number} The number of seconds in a millisecond. */
    static #SECS_PER_MSEC = 1 / 1000;
  };

  static {
    this.#DEFAULT_TIME_SOURCE = new TokenBucket.StdTimeSource();
    Object.freeze(this);
  }
}
