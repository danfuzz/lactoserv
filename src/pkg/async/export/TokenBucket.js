// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { Methods, MustBe } from '@this/typey';


/**
 * Implementation of the "token bucket" algorithm, which is more or less
 * equivalent to the "leaky bucket as meter" algorithm (though with a different
 * metaphor). That is, this class provides a rate-limiter-with-burstiness
 * service.
 *
 * This class defines neither the volume (capacity) units nor the time units. It
 * is up to clients to use whatever makes sense in their context.
 */
export class TokenBucket {
  /** @type {number} Bucket capacity, in tokens (arbitrary volume units). */
  #capacity;

  /**
   * @type {number} Bucket fill rate, in tokens per arbitrary time unit (tokens
   * / ATU).
   */
  #fillRate;

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
   * Constructs an instance. Configuration options:
   *
   * * `{number} capacity` -- Bucket capacity, in tokens (arbitrary volume
   *   units). This defines the "burstiness" allowed by the instance. Must be
   *   a finite positive number. This is a required "option."
   * * `{number} fillRate` -- Bucket fill rate, that is, how quickly the bucket
   *   gets filled, in tokens per arbitrary time unit (tokens / ATU). Must be a
   *   finite positive number. This is a required "option."
   * * `{number} initialVolume` -- The volume in the bucket at the moment of
   *   construction, in tokens. Defaults to `capacity` (that is, full and able
   *   to be maximally "bursted").
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
      capacity,
      fillRate,
      initialVolume = options.capacity,
      partialTokens = false,
      timeSource    = TokenBucket.#DEFAULT_TIME_SOURCE
    } = options;

    this.#capacity      = MustBe.number(capacity, { finite: true, minExclusive: 0 });
    this.#fillRate      = MustBe.number(fillRate, { finite: true, minExclusive: 0 });
    this.#partialTokens = MustBe.boolean(partialTokens);
    this.#timeSource    = MustBe.object(timeSource, TokenBucket.TimeSource);
    this.#lastVolume    = MustBe.number(initialVolume, { minInclusive: 0, maxInclusive: capacity });
    this.#lastNow       = this.#timeSource.now();
  }

  /** @returns {number} The bucket capacity, in tokens. */
  get capacity() {
    return this.#capacity;
  }

  /** @returns {number} The fill rate, in tokens per ATU. */
  get fillRate() {
    return this.#fillRate;
  }

  /** @returns {boolean} Does this instance grant partial tokens? */
  get partialTokens() {
    return this.#partialTokens;
  }

  /**
   * Gets an instantaneously-current snapshot of this instance. The return
   * value is an object with the following bindings:
   *
   * * `{number} now` -- The time as of the snapshot, according to this
   *   instance's time source.
   * * `{number} volume` -- The volume, that is, the quantity of tokens, in the
   *   bucket.
   *
   * @returns {object} Snapshot, as described above.
   */
  snapshotNow() {
    this.#topUpBucket();
    return { now: this.#lastNow, volume: this.#lastVolume };
  }

  /**
   * Instantaneously takes as many tokens as allowed, within the specified
   * range. This method accepts either an exact number of tokens to request or
   * an object as follows:
   *
   * * `{number} minInclusive` -- Minimum quantity of tokens to be granted. If
   *   the minimum can't be met, then the call will grant no (`0`) tokens.
   *   Defaults to `0`. Invalid if negative or larger than this instance's
   *   bucket capacity. If this instance was constructed with `partialTokens ===
   *   false`, then it is rounded up (`Math.ceil()`) when not a whole number.
   * * `{number} maxInclusive` -- Maximum quantity of tokens to be granted.
   *   Defaults to `0`. Invalid if negative, and clamped at `minInclusive`. If
   *   If this instance was constructed with `partialTokens === false`, then it
   *   is rounded down (`Math.floor()`) when not a whole number.
   *
   * This method returns an object with bindings as follows:
   *
   * * `{number} grant` -- The quantity of tokens granted to the caller. This is
   *   `0` if the minimum required grant cannot be made.
   * * `{number} waitTime` -- The amount of time needed to wait (in ATU) in
   *   order to possibly be granted the maximum requested quantity of tokens.
   *   This is a wait time in the absence of contention for the tokens from
   *   other clients; if there are other active clients, the actual required
   *   wait time will turn out to be more.
   *
   * Note: This method _first_ tops up the token bucket based on the amount of
   * time elapsed since the previous top-up, and _then_ removes tokens. This
   * means (a) that it's never possible to take more tokens than the total
   * bucket capacity, and (b) it is possible to totally empty the bucket with a
   * call to this method.
   *
   * @param {number|object} quantity Requested quantity of tokens, as described
   *   above.
   * @returns {object} Result object as described above.
   * @throws {Error} Thrown if the request is invalid (inverted range,
   *   `minInclusive` is more than the bucket capacity, etc.).
   */
  takeNow(quantity) {
    const { minInclusive, maxInclusive } = this.#parseQuantity(quantity);

    this.#topUpBucket();

    const grant     = this.#calculateGrant(minInclusive, maxInclusive);
    const newVolume = this.#lastVolume - grant;

    // The wait time takes into account any tokens which remain in the bucket
    // after a partial grant.
    const neededTokens = Math.max(0, (maxInclusive - grant) - newVolume);
    const waitTime     = neededTokens / this.#fillRate;

    this.#lastVolume = newVolume;
    return { grant, waitTime };
  }

  /**
   * Helper for `take*()` methods, which calculates an actual grant quantity.
   *
   * @param {number} minInclusive The minimum quantity of tokens to be granted.
   * @param {number} maxInclusive The maximum (inclusive) quantity of tokens to
   *   be granted.
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
      throw new Error(`Impossible take request: ${minInclusive}..${maxInclusive}, capacity ${this.#capacity}`);
    }

    if (maxInclusive < minInclusive) {
      maxInclusive = minInclusive;
    }

    return { minInclusive, maxInclusive };
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
      const grant       = elapsedTime * this.#fillRate;
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
    now() {
      return Date.now() * StdTimeSource.#SECS_PER_MSEC;
    }

    /** @override */
    async setTimeout(delay, value = null) {
      return timers.setTimeout(delay * StdTimeSource.#MSEC_PER_SEC, value);
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
