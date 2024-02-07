// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Duration } from '#x/Duration';
import { Struct } from '#x/Struct';


/**
 * Representation of a moment in time, along with some useful utility functions.
 * This class is kind of like `Date`, except notably (a) its unit is seconds not
 * milliseconds, (b) it is happy to represent sub-millisecond values, and (c)
 * other than a couple modest utilities it doesn't parse / deconstruct values.
 *
 * Instances of this class are always frozen.
 *
 * **Note:** This class intentionally does _not_ implement a `static` method to
 * get the current wall time. There are many possible "sources of truth" for the
 * time, and it is up to other code to use whatever source is appropriate in
 * context.
 */
export class Moment {
  /**
   * @type {number} The moment being represented, in the form of seconds since
   * the Unix Epoch.
   */
  #atSecs;

  /**
   * Constructs an instance.
   *
   * @param {number|bigint} atSecs The moment to represent, in the form of
   *   seconds since the Unix Epoch. Must be finite.
   */
  constructor(atSecs) {
    this.#atSecs = (typeof atSecs === 'bigint')
      ? Number(atSecs)
      : MustBe.number(atSecs, { finite: true });

    Object.freeze(this);
  }

  /**
   * @returns {number} The moment being represented, in the form of seconds
   * since the Unix Epoch.
   */
  get atSecs() {
    return this.#atSecs;
  }

  /**
   * Gets the sume `this + secs` as a new instance of this class.
   *
   * @param {number} secs Number of seconds to add.
   * @returns {Moment} The summed result.
   */
  addSecs(secs) {
    MustBe.number(secs, { finite: true });
    return new Moment(this.#atSecs + secs);
  }

  /**
   * Gets the difference `this - other` as a {@link Duration}.
   *
   * @param {Moment} other Moment to subtract from this instance.
   * @returns {Duration} The duration from `this` to `other`.
   */
  subtract(other) {
    MustBe.instanceOf(other, Moment);
    return new Duration(this.#atSecs - other.#atSecs);
  }

  /**
   * Makes a string representing this instance, in the standard HTTP format.
   * See {@link #httpStringFromSecs} for more details.
   *
   * @returns {string} The HTTP standard form.
   */
  toHttpString() {
    return Moment.httpStringFromSecs(this.#atSecs);
  }

  /**
   * Makes a friendly plain object representing this instance, which represents
   * both seconds since the Unix Epoch as well as a string indicating the
   * date-time in UTC.
   *
   * @param {object} [options] Formatting options, as with {@link
   *   #stringFromSecs}.
   * @returns {object} Friendly representation object.
   */
  toPlainObject(options = {}) {
    return Moment.plainObjectFromSecs(this.#atSecs, options);
  }

  /**
   * Makes a date-time string representing this instance, in a reasonably pithy
   * and understandable form. The result is a string representing the date-time
   * in UTC.
   *
   * @param {object} [options] Formatting options, as with {@link
   *   #stringFromSecs}.
   * @returns {string} The friendly time string.
   */
  toString(options = {}) {
    return Moment.stringFromSecs(this.#atSecs, options);
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
    const str = this.toString({ decimals: 6 });

    return new Struct(Moment, null, this.#atSecs, str);
  }


  //
  // Static members
  //

  /**
   * Makes an instance of this class from a _millisecond_ time, such as might be
   * returned from `Date.now()`.
   *
   * @param {number} atMsec The millisecond time.
   * @returns {Moment} Corresponding instance of this class.
   */
  static fromMsec(atMsec) {
    return new Moment(atMsec / 1000);
  }

  /**
   * Makes a string representing the given number of seconds since the Unix
   * Epoch (note: _not_ milliseconds), in the standard HTTP format. This format
   * is used, notably, for request and response header fields that represent
   * dates.
   *
   * **Note:** The HTTP standard, RFC 9110 section 5.6.7 in particular, is very
   * specific about the format.
   *
   * @param {number|bigint} atSecs Time in the form of seconds since the Unix
   *   Epoch.
   * @returns {string} The HTTP standard form.
   */
  static httpStringFromSecs(atSecs) {
    atSecs = (typeof atSecs === 'bigint')
      ? Number(atSecs)
      : MustBe.number(atSecs, { finite: true });

    return new Date(atSecs * 1000).toUTCString();
  }

  /**
   * Makes a friendly plain object representing a moment in time, which
   * represents both seconds since the Unix Epoch as well as a string indicating
   * the date-time in UTC.
   *
   * @param {number} atSecs The moment to represent, in the form of seconds
   *   since the Unix Epoch.
   * @param {object} [options] Formatting options, as with {@link
   *   #stringFromSecs}.
   * @returns {object} Friendly representation object.
   */
  static plainObjectFromSecs(atSecs, options = {}) {
    return {
      atSecs,
      utc: Moment.stringFromSecs(atSecs, options)
    };
  }

  /**
   * Makes a date-time string in a reasonably pithy and understandable form. The
   * result is a string representing the date-time in UTC.
   *
   * @param {number} atSecs Time in the form of seconds since the Unix Epoch.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.colons] Use colons to separate the
   *   time-of-day components?
   * @param {number} [options.decimals] Number of fractional-second digits
   *    of precision. **Note:** Fractions of seconds are truncated, not rounded.
   * @returns {string} The friendly time string.
   */
  static stringFromSecs(atSecs, options = {}) {
    const { colons = true, decimals = 0 } = options;

    // Formats a number as *t*wo *d*igits.
    const td = (num) => {
      return (num < 10) ? `0${num}` : `${num}`;
    };

    // Creates the fractional seconds part of the string.
    const makeFrac = () => {
      // Non-obvious: If you take `atSecs % 1` and then operate on the remaining
      // fraction, you can end up with a string representation that's off by 1,
      // because of floating point (im)precision. That's why we _don't_ do that.
      const tenPower = 10 ** decimals;
      const frac     = Math.floor(atSecs * tenPower % tenPower);
      const result   = frac.toString().padStart(decimals, '0');

      return `.${result}`;
    };

    const when    = new Date(atSecs * 1000);
    const date    = when.getUTCDate();
    const month   = when.getUTCMonth();
    const year    = when.getUTCFullYear();
    const hours   = when.getUTCHours();
    const mins    = when.getUTCMinutes();
    const secs    = when.getUTCSeconds();
    const timeSep = colons ? ':' : '';
    const frac    = (decimals === 0) ? '' : makeFrac();

    return '' +
      `${year}${td(month + 1)}${td(date)}-` +
      `${td(hours)}${timeSep}${td(mins)}${timeSep}${td(secs)}${frac}`;
  }
}
