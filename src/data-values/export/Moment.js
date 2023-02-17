// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Struct } from '#x/Struct';


/**
 * Representation of a moment in time, along with some useful utility functions.
 * This class is kind of like `Date`, except notably (a) its unit is seconds not
 * milliseconds, (b) it is happy to represent sub-millisecond values, and (c)
 * other than a couple modest utilities it doesn't parse / deconstruct values.
 *
 * Instances of this class are always frozen.
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
   * @param {number} atSecs The moment to represent, in the form of seconds
   * since the Unix Epoch. Must be finite.
   */
  constructor(atSecs) {
    this.#atSecs = MustBe.number(atSecs, { finite: true });
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
   * Makes a friendly plain object representing this instance, which represents
   * both seconds since the Unix Epoch as well as a string indicating the
   * date-time in UTC.
   *
   * @param {object} [options = {}] Options, as with {@link #stringFromSecs}.
   * @returns {object} Friendly representation object.
   */
  toPlainObject(options = {}) {
    return Moment.plainObjectFromSecs(this.#atSecs, options);
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
    const str = Moment.stringFromSecs(this.#atSecs);

    return new Struct(Moment, null, this.#atSecs, str);
  }


  //
  // Static members
  //

  /**
   * Makes a friendly plain object representing a moment in time, which
   * represents both seconds since the Unix Epoch as well as a string indicating
   * the date-time in UTC.
   *
   * @param {number} atSecs The moment to represent, in the form of seconds
   *   since the Unix Epoch.
   * @param {object} [options = {}] Options, as with {@link #stringFromSecs}.
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
   * The result is a string representing the date-time in UTC.
   *
   * @param {number} atSecs Time in the form of seconds since the Unix Epoch.
   * @param {object} [options = {}] Formatting options.
   * @param {boolean} [options.colons = true] Use colons to separate the
   *   time-of-day components?
   * @param {number} [options.decimals = 0] Number of fractional-second digits
   *    of precision. **Note:** Fractions of seconds are truncated, not rounded.
   * @returns {string} The friendly time string.
   */
  static stringFromSecs(atSecs, options = {}) {
    const { colons = true, decimals = 0 } = options;

    const d       = new Date(atSecs * 1000);
    const timeSep = colons ? ':' : '';
    const parts   = [
      d.getUTCFullYear().toString(),
      (d.getUTCMonth() + 1).toString().padStart(2, '0'),
      d.getUTCDate().toString().padStart(2, '0'),
      '-',
      d.getUTCHours().toString().padStart(2, '0'),
      timeSep,
      d.getUTCMinutes().toString().padStart(2, '0'),
      timeSep,
      d.getUTCSeconds().toString().padStart(2, '0')
    ];

    if (decimals !== 0) {
      // Non-obvious: If you take `atSecs % 1` and then operate on the remaining
      // fraction, you can end up with a string representation that's off by 1,
      // because of floating point (im)precision. That's why we _don't_ do that.
      const tenPower = 10 ** decimals;
      const frac     = Math.floor(atSecs * tenPower % tenPower);
      const fracStr  = frac.toString().padStart(decimals, '0');
      parts.push('.', fracStr);
    }

    return parts.join('');
  }
}
