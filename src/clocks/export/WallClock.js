// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as process from 'node:process';

import { Moment } from '@this/data-values';


/**
 * Utilities for dealing with wall time (that is, actual time in the real
 * world). This is meant to be a replacement for use of `Date.now()` and the
 * like.
 */
export class WallClock {
  /** @type {number} The number of seconds in a nanosecond. */
  static #SECS_PER_NSEC = 1 / 1_000_000_000;

  /** @type {bigint} The number of milliseconds in a nanosecond. */
  static #MSEC_PER_NSEC = 1_000_000n;

  /** @type {bigint} Last result from `process.hrtime.bigint()`. */
  static #lastHrtimeNsec = -1n;

  /**
   * @type {bigint} Last "now" measured by {@link #now}, as a `bigint`
   * representing a nanosecond-based Unix Epoch time.
   */
  static #lastNowNsec = -1n;

  /**
   * Gets the "now" moment as a {@link Moment}, which represents (fractional)
   * seconds since the Unix Epoch.
   *
   * **Note:** This method uses both `Date.now()` and Node's `process.hrtime`,
   * in an attempt to provide more accuracy and precision than the former alone.
   *
   * @returns {Moment} "Now."
   */
  static now() {
    // What's going on here: We attempt to use `hrtime()` -- which has nsec
    // precision but an arbitrary zero-time, and which we don't assume runs at
    // exactly (effective) wall-clock rate -- to improve on the precision of
    // `Date.now()` -- which has msec precision and a well-established base, and
    // which we assume is as accurate as it is precise.

    const hrtimeNsec  = process.hrtime.bigint();
    const dateNowNsec = BigInt(Date.now()) * WallClock.#MSEC_PER_NSEC;
    let nowNsec;

    if (this.#lastNowNsec < 0) {
      nowNsec = dateNowNsec;
    } else {
      const hrDiffNsec    = hrtimeNsec - this.#lastHrtimeNsec;
      const hrTrackedNsec = this.#lastNowNsec + hrDiffNsec;
      if (   (hrTrackedNsec >= (dateNowNsec - WallClock.#MSEC_PER_NSEC))
          && (hrTrackedNsec <= (dateNowNsec + WallClock.#MSEC_PER_NSEC))) {
        nowNsec = hrTrackedNsec;
      } else {
        // The wall time reconstructed from the difference between `hrtime()`
        // readings is too far off from what `Date.now()` reports. That is, it's
        // not useful, so we just use a straight `Date.now()` result.
        nowNsec = dateNowNsec;
      }
    }

    if (nowNsec < this.#lastNowNsec) {
      nowNsec = this.#lastNowNsec + WallClock.#MSEC_PER_NSEC;
    }

    this.#lastHrtimeNsec  = hrtimeNsec;
    this.#lastNowNsec     = nowNsec;

    const nowSec = Number(nowNsec) * WallClock.#SECS_PER_NSEC;
    return new Moment(nowSec);
  }
}
