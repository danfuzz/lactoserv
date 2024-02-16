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
  #sec;

  /**
   * Constructs an instance.
   *
   * @param {number} sec The number of seconds to represent. Must be finite.
   */
  constructor(sec) {
    this.#sec = MustBe.number(sec, { finite: true });
    Object.freeze(this);
  }

  /** @returns {number} The number of seconds being represented. */
  get sec() {
    return this.#sec;
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
    return Duration.plainObjectFromSec(this.#sec);
  }

  /**
   * Makes a human-friendly string representing this instance. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the duration.
   *
   * @param {object} [options] Formatting options, as with {@link
   *   #stringFromSec}.
   * @returns {string} The friendly form.
   */
  toString(options = {}) {
    return Duration.stringFromSec(this.#sec, options);
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
    const str = Duration.stringFromSec(this.#sec);

    return new Struct(Duration, null, this.#sec, str);
  }


  //
  // Static members
  //

  /** @type {Duration} Instance with value of `0`. */
  static ZERO = new Duration(0);

  /**
   * @type {Map<string, number>} Multipliers for each named unit to convert to
   * seconds.
   */
  static #SEC_PER_UNIT = new Map(Object.entries({
    'ns':   (1 / 1_000_000_000),
    'nsec': (1 / 1_000_000_000),
    'us':   (1 / 1_000_000),
    'usec': (1 / 1_000_000),
    'ms':   (1 / 1_000),
    'msec': (1 / 1_000),
    's':    1,
    'sec':  1,
    'm':    60,
    'min':  60,
    'h':    (60 * 60),
    'hr':   (60 * 60),
    'd':    (60 * 60 * 24),
    'day':  (60 * 60 * 24)
  }));

  /**
   * Parses a string representing a duration, returning an instance of this
   * class. The given value may have arbitrary spaces around it, and either a
   * space or an underscore (or nothing) is accepted between the number and unit
   * name. The number is allowed to be any regular floating point value
   * (including exponents), with underscores allowed in the middle of it (for
   * ease of reading, as with normal JavaScript constants). The allowed units
   * are:
   *
   * * `ns` or `nsec` -- microseconds
   * * `us` or `usec` -- microseconds
   * * `ms` or `msec` -- milliseconds
   * * `s` or `sec` -- seconds
   * * `m` or `min` -- minutes
   * * `h` or `hr` -- hours
   * * `d` or `day` -- days (defined as exactly 24 hours)
   *
   * @param {string} value The value to parse.
   * @returns {?Duration} The parsed duration, or `null` if the value could not
   *   be parsed.
   */
  static parse(value) {
    const sec = this.parseSec(value);

    return (sec === null) ? null : new Duration(sec);
  }

  /**
   * Parses a string representing a duration, returning a number of seconds.
   * See {@link #parse} for details about the accepted formats.
   *
   * @param {string} value The value to parse.
   * @returns {?number} The parsed number of seconds, or `null` if the value
   *   could not be parsed.
   */
  static parseSec(value) {
    MustBe.string(value);

    const match =
      value.match(/^ *(?<num>[-+.0-9][-+._0-9eE]*)[ ]?(?<name>[a-zA-Z]{1,10}) *$/);

    if (!match) {
      return null;
    }

    const { num: numStr, name } = match.groups;
    const num                   = Number(numStr.replaceAll(/_/g, ''));
    const mult = this.#SEC_PER_UNIT.get(name.toLowerCase());

    if (isNaN(num) || !mult) {
      return null;
    }

    return num * mult;
  }

  /**
   * Makes a friendly plain object representing a time duration, with both an
   * exact number of seconds (the original value) and a human-oriented string
   * whose format varies based on the magnitude of the duration and which
   * represents the rounded value.
   *
   * @param {number} durationSec Duration in seconds.
   * @returns {object} Friendly compound object.
   */
  static plainObjectFromSec(durationSec) {
    return {
      sec:      durationSec,
      duration: Duration.stringFromSec(durationSec)
    };
  }

  /**
   * Makes a human-friendly duration (elapsed time) string. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the duration.
   *
   * @param {number} durationSec Duration in seconds.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.spaces] Use spaces to separate the number
   *   from the units? If `false` an underscore is used.
   * @returns {string} The friendly form.
   */
  static stringFromSec(durationSec, options = {}) {
    const { spaces = true } = options;

    const spaceyChar = spaces ? ' ' : '_';

    // For small numbers of (including fractional) seconds, just represent a
    // single number and a reasonable unit name.
    if (durationSec < 99.9995) {
      const makeResult = (value, units) => {
        return `${value.toFixed(3)}${spaceyChar}${units}`;
      };

      if (durationSec <= 0) {
        // This isn't generally expected to ever be the case in normal
        // operation, but produce something sensible just in case something goes
        // wonky.
        return (durationSec === 0)
          ? `0${spaceyChar}sec${spaces ? ' (instantaneous)' : ''}`
          : makeResult(durationSec, 'sec');
      }

      let   range = Math.floor(Math.floor(Math.log10(durationSec)) / 3) * 3;
      let rounded = Math.round(durationSec * (10 ** (-range + 3))) / 1000;
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
          const roundedNsec = Math.round(durationSec * (10 ** (9 + 3))) / 1000;
          return makeResult(roundedNsec, 'nsec');
        }
      }
    }

    // We use bigints here because that makes the calculations much more
    // straightforward.
    const outputTenth = (durationSec < ((60 * 60) - 0.05));
    const totalTenths = outputTenth
      ? BigInt(Math.round(durationSec * 10))
      : BigInt(Math.round(durationSec) * 10);

    const tenth = totalTenths % 10n;
    const sec   = (totalTenths / 10n) % 60n;
    const min   = (totalTenths / (10n * 60n)) % 60n;
    const hour  = (totalTenths / (10n * 60n * 60n)) % 24n;
    const day   = totalTenths / (10n * 60n * 60n * 24n);

    const parts = [];

    if (day > 0) {
      parts.push(day, 'd ', hour);
    } else if (hour > 0) {
      parts.push(hour);
    }
    parts.push(':');

    if (min < 10) {
      parts.push('0');
    }
    parts.push(min, ':');

    if (sec < 10) {
      parts.push('0');
    }
    parts.push(sec);

    if (outputTenth) {
      parts.push('.', tenth);
    }

    return parts.join('');
  }
}
