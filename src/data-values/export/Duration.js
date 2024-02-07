// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Struct } from '#x/Struct';


/**
 * Representation of a time duration, along with some useful utility functions.
 * This class allows negative durations; though not useful all the time, there's
 * arguably at least some utility to them.
 *
 * Instances of this class are always frozen.
 */
export class Duration {
  /** @type {number} The number of seconds being represented. */
  #secs;

  /**
   * Constructs an instance.
   *
   * @param {number} secs The number of seconds to represent. Must be finite.
   */
  constructor(secs) {
    this.#secs = MustBe.number(secs, { finite: true });
    Object.freeze(this);
  }

  /** @returns {number} The number of seconds being represented. */
  get secs() {
    return this.#secs;
  }

  /**
   * Makes a friendly plain object representing this instance, with both an
   * exact number of seconds (the original value) and a human-oriented string
   * whose format varies based on the magnitude of the duration and which
   * represents the rounded value.
   *
   * @returns {object} Friendly compound object.
   */
  toPlainObject() {
    return Duration.plainObjectFromSecs(this.#secs);
  }

  /**
   * Makes a human-friendly string representing this instance. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the duration.
   *
   * @param {object} [options] Formatting options, as with {@link
   *   #stringFromSecs}.
   * @returns {string} The friendly form.
   */
  toString(options = {}) {
    return Duration.stringFromSecs(this.#secs, options);
  }

  /**
   * Implementation of `data-values` custom-encode protocol.
   *
   * @returns {Struct} Encoded form.
   */
  [BaseConverter.ENCODE]() {
    // Note: This is included for the convenience of humans who happen to be
    // looking at logs (etc.), but is not actually used when reconstructing an
    // instance. TODO: Re-evaluate this tactic.
    const str = Duration.stringFromSecs(this.#secs);

    return new Struct(Duration, null, this.#secs, str);
  }


  //
  // Static members
  //

  /** @type {Duration} Instance with value of `0`. */
  static ZERO = new Duration(0);

  /**
   * Makes a friendly plain object representing a time duration, with both an
   * exact number of seconds (the original value) and a human-oriented string
   * whose format varies based on the magnitude of the duration and which
   * represents the rounded value.
   *
   * @param {number} durationSecs Duration in seconds.
   * @returns {object} Friendly compound object.
   */
  static plainObjectFromSecs(durationSecs) {
    return {
      secs:     durationSecs,
      duration: Duration.stringFromSecs(durationSecs)
    };
  }

  /**
   * Makes a human-friendly duration (elapsed time) string. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the duration.
   *
   * @param {number} durationSecs Duration in seconds.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.spaces] Use spaces to separate the number
   *   from the units? If `false` an underscore is used.
   * @returns {string} The friendly form.
   */
  static stringFromSecs(durationSecs, options = {}) {
    const { spaces = true } = options;

    const spaceyChar = spaces ? ' ' : '_';

    // For small numbers of (including fractional) seconds, just represent a
    // single number and a reasonable unit name.
    if (durationSecs < 99.9995) {
      const makeResult = (value, units) => {
        return `${value.toFixed(3)}${spaceyChar}${units}`;
      };

      if (durationSecs <= 0) {
        // This isn't generally expected to ever be the case in normal
        // operation, but produce something sensible just in case something goes
        // wonky.
        return (durationSecs === 0)
          ? `0${spaceyChar}sec${spaces ? ' (instantaneous)' : ''}`
          : makeResult(durationSecs, 'sec');
      }

      let   range = Math.floor(Math.floor(Math.log10(durationSecs)) / 3) * 3;
      let rounded = Math.round(durationSecs * (10 ** (-range + 3))) / 1000;
      if (rounded === 1000) {
        range += 3;
        rounded = 1;
      }
      switch (range) {
        case 0:  return makeResult(rounded, 'sec');
        case -3: return makeResult(rounded, 'msec');
        case -6: return makeResult(rounded, 'usec');
        case -9: return makeResult(rounded, 'nsec');
        default: {
          const roundedNsec = Math.round(durationSecs * (10 ** (9 + 3))) / 1000;
          return makeResult(roundedNsec, 'nsec');
        }
      }
    }

    // Convert `secs` to `BigInt`, because that makes the calculations much more
    // straightforward.
    const outputTenths = (durationSecs < ((60 * 60) - 0.05));
    const totalTenths  = outputTenths
      ? BigInt(Math.round(durationSecs * 10))
      : BigInt(Math.round(durationSecs) * 10);

    const tenths = totalTenths % 10n;
    const secs   = (totalTenths / 10n) % 60n;
    const mins   = (totalTenths / (10n * 60n)) % 60n;
    const hours  = (totalTenths / (10n * 60n * 60n)) % 24n;
    const days   = totalTenths / (10n * 60n * 60n * 24n);

    const parts = [];

    if (days > 0) {
      parts.push(days, 'd ', hours);
    } else if (hours > 0) {
      parts.push(hours);
    }
    parts.push(':');

    if (mins < 10) {
      parts.push('0');
    }
    parts.push(mins, ':');

    if (secs < 10) {
      parts.push('0');
    }
    parts.push(secs);

    if (outputTenths) {
      parts.push('.', tenths);
    }

    return parts.join('');
  }
}
