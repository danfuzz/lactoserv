// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';

import { Duration } from '#x/Duration';


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
export class Moment extends IntfDeconstructable {
  /**
   * The moment being represented, in the form of seconds since the Unix Epoch.
   *
   * @type {number}
   */
  #atSec;

  /**
   * Constructs an instance.
   *
   * @param {number|bigint} atSec The moment to represent, in the form of
   *   seconds since the Unix Epoch. Must be finite.
   */
  constructor(atSec) {
    super();

    this.#atSec = (typeof atSec === 'bigint')
      ? Number(atSec)
      : MustBe.number(atSec, { finite: true });

    Object.freeze(this);
  }

  /**
   * @returns {number} The moment being represented, in the form of milliseconds
   * since the Unix Epoch.
   */
  get atMsec() {
    return this.#atSec * 1000;
  }

  /**
   * @returns {number} The moment being represented, in the form of seconds
   * since the Unix Epoch.
   */
  get atSec() {
    return this.#atSec;
  }

  /**
   * Gets the sum `this + duration` as a new instance of this class.
   *
   * @param {Duration} duration Amount of time to add.
   * @returns {Moment} The summed result.
   */
  add(duration) {
    MustBe.instanceOf(duration, Duration);
    return new Moment(this.#atSec + duration.sec);
  }

  /**
   * Gets the sum `this + sec` as a new instance of this class.
   *
   * @param {number} sec Number of seconds to add.
   * @returns {Moment} The summed result.
   */
  addSec(sec) {
    MustBe.number(sec, { finite: true });
    return new Moment(this.#atSec + sec);
  }

  /**
   * Compares the value of this instance to another, returning the usual values
   * `-1`, `0`, or `1` depending on the result of comparison.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {number} Usual comparison result.
   */
  compare(other) {
    MustBe.instanceOf(other, Moment);

    const thisAt  = this.#atSec;
    const otherAt = other.#atSec;

    if (thisAt === otherAt) {
      return 0;
    } else if (thisAt < otherAt) {
      return -1;
    } else {
      return 1;
    }
  }

  /**
   * Shorthand for `.compare(other) == 0`.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {boolean} `true` iff `other == this`.
   */
  eq(other) {
    return this.compare(other) === 0;
  }

  /**
   * Shorthand for `.compare(other) >= 0`.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {boolean} `true` iff `other >= this`.
   */
  ge(other) {
    return this.compare(other) >= 0;
  }

  /**
   * Shorthand for `.compare(other) > 0`.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {boolean} `true` iff `other > this`.
   */
  gt(other) {
    return this.compare(other) > 0;
  }

  /**
   * Shorthand for `.compare(other) <= 0`.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {boolean} `true` iff `other <= this`.
   */
  le(other) {
    return this.compare(other) <= 0;
  }

  /**
   * Shorthand for `.compare(other) < 0`.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {boolean} `true` iff `other < this`.
   */
  lt(other) {
    return this.compare(other) < 0;
  }

  /**
   * Shorthand for `.compare(other) != 0`.
   *
   * @param {Moment} other Instance to compare to.
   * @returns {boolean} `true` iff `other != this`.
   */
  ne(other) {
    return this.compare(other) !== 0;
  }

  /**
   * Gets the difference `this - other` as a {@link Duration}.
   *
   * @param {Moment} other Moment to subtract from this instance.
   * @returns {Duration} The duration from `this` to `other`.
   */
  subtract(other) {
    MustBe.instanceOf(other, Moment);
    return new Duration(this.#atSec - other.#atSec);
  }

  /**
   * Returns a `Date` instance that represents the same moment as `this`.
   *
   * @returns {Date} The corresponding `Date`.
   */
  toDate() {
    return new Date(this.atMsec);
  }

  /**
   * Makes a string representing this instance, in the standard HTTP format. See
   * {@link #httpStringFromSec} for more details.
   *
   * @returns {string} The HTTP standard form.
   */
  toHttpString() {
    return Moment.httpStringFromSec(this.#atSec);
  }

  /**
   * Makes a string representing _just_ the seconds and fractional seconds of
   * this instance.
   *
   * @param {object} [options] Formatting options, as with
   *   {@link #justSecsStringFromSec}.
   * @returns {string} The just-seconds form.
   */
  toJustSecs(options = {}) {
    return Moment.justSecsStringFromSec(this.#atSec, options);
  }

  /**
   * Makes a friendly plain object representing this instance, which represents
   * both seconds since the Unix Epoch as well as a string indicating the
   * date-time in UTC.
   *
   * @param {object} [options] Formatting options, as with
   *   {@link #stringFromSec}.
   * @returns {object} Friendly representation object.
   */
  toPlainObject(options = {}) {
    return Moment.plainObjectFromSec(this.#atSec, options);
  }

  /**
   * Makes a date-time string representing this instance, in a reasonably pithy
   * and understandable form. The result is a string representing the date-time
   * in UTC.
   *
   * @param {object} [options] Formatting options, as with
   *   {@link #stringFromSec}.
   * @returns {string} The friendly time string.
   */
  toString(options = {}) {
    return Moment.stringFromSec(this.#atSec, options);
  }

  /** @override */
  deconstruct(forLogging) {
    const extraArgs = forLogging ? [this.toString({ decimals: 6 })] : [];
    return new Sexp(Moment, this.#atSec, ...extraArgs);
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
   * @param {number|bigint} atSec Time in the form of seconds since the Unix
   *   Epoch.
   * @returns {string} The HTTP standard form.
   */
  static httpStringFromSec(atSec) {
    atSec = (typeof atSec === 'bigint')
      ? Number(atSec)
      : MustBe.number(atSec, { finite: true });

    return new Date(atSec * 1000).toUTCString();
  }

  /**
   * Makes a friendly plain object representing a moment in time, which
   * represents both seconds since the Unix Epoch as well as a string indicating
   * the date-time in UTC.
   *
   * @param {number} atSec The moment to represent, in the form of seconds since
   *   the Unix Epoch.
   * @param {object} [options] Formatting options, as with
   *   {@link #stringFromSec}.
   * @returns {object} Friendly representation object.
   */
  static plainObjectFromSec(atSec, options = {}) {
    return {
      atSec,
      utc: Moment.stringFromSec(atSec, options)
    };
  }

  /**
   * Makes a string _just_ representing the seconds of the given time value.
   *
   * @param {number} atSec Time in the form of seconds since the Unix Epoch.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.colons] Use colons to separate the time-of-day
   *   components? In this case, it means whether to prefix the result with a
   *   colon.
   * @param {number} [options.decimals] Number of fractional-second digits
   *    of precision. **Note:** Fractions of seconds are truncated, not rounded.
   * @returns {string} The just-seconds string.
   */
  static justSecsStringFromSec(atSec, options = {}) {
    const { colons = true, decimals = 0 } = options;

    const timeSep = colons ? ':' : '';
    const sec     = Moment.#td(Math.trunc(atSec % 60));
    const frac    = this.#fracString(atSec, decimals);
    return `${timeSep}${sec}${frac}`;
  }

  /**
   * Makes a date-time string in a reasonably pithy and understandable form. The
   * result is a string representing the date-time in UTC.
   *
   * @param {number} atSec Time in the form of seconds since the Unix Epoch.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.colons] Use colons to separate the time-of-day
   *   components?
   * @param {boolean} [options.dashes] Use dashes to separate the year-and-day
   *   components?
   * @param {number} [options.decimals] Number of fractional-second digits
   *    of precision. **Note:** Fractions of seconds are truncated, not rounded.
   * @param {boolean} [options.middleUnderscore] Use an underscore between the
   *    year-and-day and the time-of-day components? If `false`, a space will be
   *    used.
   * @returns {string} The friendly time string.
   */
  static stringFromSec(atSec, options = {}) {
    const {
      colons = true,
      dashes = true,
      decimals = 0,
      middleUnderscore = true
    } = options;

    const when    = new Date(atSec * 1000);
    const date    = this.#td(when.getUTCDate());
    const month   = this.#td(when.getUTCMonth() + 1);
    const year    = when.getUTCFullYear();
    const hour    = this.#td(when.getUTCHours());
    const min     = this.#td(when.getUTCMinutes());
    const sec     = this.#td(when.getUTCSeconds());
    const frac    = this.#fracString(atSec, decimals);
    const timeSep = colons ? ':' : '';
    const dateSep = dashes ? '-' : '';
    const mainSep = middleUnderscore ? '_' : ' ';

    return `${year}${dateSep}${month}${dateSep}${date}${mainSep}${hour}${timeSep}${min}${timeSep}${sec}${frac}`;
  }

  /**
   * Makes a fractional seconds part of a string result.
   *
   * @param {number} atSec Unix Epoch seconds time.
   * @param {number} decimals Number of decimal places.
   * @returns {string} The corresponding string.
   */
  static #fracString(atSec, decimals) {
    if (decimals === 0) {
      return '';
    }

    // Non-obvious: If you take `atSec % 1` and then operate on the remaining
    // fraction, you can end up with a string representation that's off by 1,
    // because of floating point (im)precision. That's why we _don't_ do that.

    const tenPower = 10 ** decimals;
    const frac     = Math.floor(atSec * tenPower % tenPower);
    const result   = frac.toString().padStart(decimals, '0');

    return `.${result}`;
  }

  /**
   * Formats a number as *t*wo *d*igits.
   *
   * @param {number} num The number.
   * @returns {string} The corresponding string.
   */
  static #td(num) {
    return (num < 10) ? `0${num}` : `${num}`;
  }
}
