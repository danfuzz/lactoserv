// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogSource } from '#x/LogSource';

import { MustBe } from '@this/typey';

import * as process from 'node:process';


/**
 * Standard logging environment, which is hooked up to the "real world."
 */
export class StdLoggingEnvironment extends BaseLoggingEnvironment {
  /** @type {LogSource} Log source attached to {@link #emit}. */
  #source;

  /** @type {bigint} Last result from `hrtime.bigint()`. */
  #lastHrtimeNsec = -1n;

  /** @type {bigint} Last result from {@link #_impl_nowSec}, as a `bigint`. */
  #lastNowNsec = -1n;

  /**
   * Constructs an instance.
   *
   * @param {LogSource} source Source to emit events from.
   */
  constructor(source) {
    super();

    this.#source = MustBe.object(source, LogSource);
  }

  /** @override */
  _impl_emit(record) {
    this.#source.emit(record);
  }

  /** @override */
  _impl_nowSec() {
    // What's going on here: We attempt to use `hrtime()` -- which has nsec
    // precision but has an arbitrary zero-time -- to improve on the precision
    // of `Date.now()` -- which has msec precision and a well-established base.

    const hrtimeNsec  = process.hrtime.bigint();
    const dateNowNsec = BigInt(Date.now()) * StdLoggingEnvironment.#MSEC_PER_NSEC;
    let nowNsec;

    if (this.#lastNowNsec < 0) {
      nowNsec = dateNowNsec;
    } else {
      const hrDiffNsec    = hrtimeNsec - this.#lastHrtimeNsec;
      const hrTrackedNsec = this.#lastNowNsec + hrDiffNsec;
      if (   (hrTrackedNsec >= (dateNowNsec - StdLoggingEnvironment.#MSEC_PER_NSEC))
          && (hrTrackedNsec <= (dateNowNsec + StdLoggingEnvironment.#MSEC_PER_NSEC))) {
        nowNsec = hrTrackedNsec;
      } else {
        // The wall time reconstructed from the difference between `hrtime()`
        // readings is too far off from what `Date.now()` reports. That is, it's
        // not useful, so we just use a straight `Date.now()` result.
        nowNsec = dateNowNsec;
      }
    }

    if (nowNsec < this.#lastNowNsec) {
      nowNsec = this.#lastNowNsec + StdLoggingEnvironment.#MSEC_PER_NSEC;
    }

    this.#lastHrtimeNsec  = hrtimeNsec;
    this.#lastNowNsec     = nowNsec;

    return Number(nowNsec) * StdLoggingEnvironment.#SECS_PER_NSEC;
  }

  /** @override */
  _impl_stackTrace() {
    return new Error().stack.split('\n').slice(1);
  }


  //
  // Static members
  //

  /** {number} The number of seconds in a nanosecond. */
  static #SECS_PER_NSEC = 1 / 1_000_000_000;

  /** {bigint} The number of milliseconds in a nanosecond. */
  static #MSEC_PER_NSEC = 1_000_000n;
}
