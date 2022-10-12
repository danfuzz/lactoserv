// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { Methods, MustBe } from '@this/typey';


/**
 * Implementation of the "leaky bucket as meter" algorithm, which is more or
 * less equivalent to the "token bucket" algorithm (though with a different
 * metaphor). That is, this class provides a rate-limit-with-burstiness service.
 *
 * This class defines neither the volume (capacity) units nor the time units. It
 * is up to clients to use whatever makes sense in their context.
 */
export class LeakyBucket {
  /** @type {number} Bucket capacity, in arbitrary volume units (AVU). */
  #capacity;

  /**
   * @type {number} Bucket flow rate, in arbitrary volume units per arbitrary
   * time unit (AVU / ATU).
   */
  #flowRate;

  /** @type {LeakyBucket.BaseTimeSource} Time measurement implementation. */
  #timeSource;

  /** @type {number} Most recently measured time. */
  #lastNow;

  /**
   * @type {number} The fullness of the bucket as a fraction in the range
   * `0..1` at time {@link #lastNow}.
   */
  #lastFullness;

  /**
   * Constructs an instance. Configuration options:
   *
   * * `{number} capacity` -- Bucket capacity, in arbitrary volume units
   *   (AVU). This defines the "burstiness" allowed by the instance. This is a
   *   required "option."
   * * `{number} flowRate` -- Bucket flow rate, that is, how quickly the bucket
   *   leaks its volume out, in arbitrary volume units per arbitrary time unit
   *   (AVU / ATU). This is a required "option."
   * * `{number} initialFullness` -- How full the bucket is at the moment of
   *   construction, expressed as a fraction in the range `0..1`. Defaults to
   *   `0` (that is, empty and able to be maximally "bursted").
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
      flowRate,
      initialFullness = 0,
      timeSource      = LeakyBucket.#DEFAULT_TIME_SOURCE
    } = options;

    this.#capacity     = MustBe.number(capacity, { finite: true, minExclusive: 0 });
    this.#flowRate     = MustBe.number(flowRate, { finite: true, minExclusive: 0 });
    this.#timeSource   = MustBe.object(timeSource, LeakyBucket.TimeSource);
    this.#lastFullness = MustBe.number(initialFullness, { minInclusive: 0, maxInclusive: 1 });
    this.#lastNow      = this.#timeSource.now();
  }

  // TODO

  //
  // Static members
  //

  /** {number} The number of milliseconds in a second. */
  static #MSEC_PER_SEC = 1000;

  /** {number} The number of seconds in a millisecond. */
  static #SECS_PER_MSEC = 1 / 1000;

  /** @type {LeakyBucket.StdTimeSource} Default time source. */
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
    this.#DEFAULT_TIME_SOURCE = new LeakyBucket.StdTimeSource();
    Object.freeze(this);
  }
}
