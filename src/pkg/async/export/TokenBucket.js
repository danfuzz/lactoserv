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
   *   units). This defines the "burstiness" allowed by the instance. This is a
   *   required "option."
   * * `{number} fillRate` -- Bucket fill rate, that is, how quickly the bucket
   *   gets filled, in tokens per arbitrary time unit (tokens / ATU). This is a
   *   required "option."
   * * `{number} initialVolume` -- The volume in the bucket at the moment of
   *   construction, in tokens. Defaults to `capacity` (that is, full and able
   *   to be maximally "bursted").
   * * `{boolean} partialTokens` -- If `true`, allows the instance to provide
   *   partial tokens (e.g. give a client `1.25` tokens). If `false`, all token
   *   handoffs from the instance are quantized (by rounding up, i.e.
   *   `Math.ceil()`) to integer values. Defaults to `false`.
   * * `{LeakyBucket.BaseTimeSource} timeSource` -- What to use to determine the
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

  // TODO

  //
  // Static members
  //

  /** {number} The number of milliseconds in a second. */
  static #MSEC_PER_SEC = 1000;

  /** {number} The number of seconds in a millisecond. */
  static #SECS_PER_MSEC = 1 / 1000;

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
      return Date.now() * this.#SECS_PER_MSEC;
    }

    /** @override */
    async setTimeout(delay, value = null) {
      return timers.setTimeout(delay * this.#MSEC_PER_SEC, value);
    }
  };

  static {
    this.#DEFAULT_TIME_SOURCE = new TokenBucket.StdTimeSource();
    Object.freeze(this);
  }
}
