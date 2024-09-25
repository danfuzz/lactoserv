// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConverter, Sexp } from '@this/codec';

import { ByteCount } from '#x/ByteCount';
import { Frequency } from '#x/Frequency';
import { UnitQuantity } from '#x/UnitQuantity';


/**
 * Representation of a rate of data flow, in units of (possibly fractional)
 * bytes per second. Also, this class allows negative values; though not useful
 * all the time, there's arguably at least some utility to them.
 *
 * Instances of this class are always frozen.
 */
export class ByteRate extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} bytePerSec The number of bytes per second. Must be finite.
   */
  constructor(bytePerSec) {
    super(bytePerSec, 'byte', 'sec');
  }

  /** @returns {number} The rate being represented. */
  get bytePerSec() {
    return this.value;
  }

  /**
   * Makes a human-friendly string representing this instance. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the value.
   *
   * @param {object} [options] Formatting options, as with
   *   {@link #stringFromBytePerSec}.
   * @returns {string} The friendly form.
   */
  toString(options = {}) {
    return ByteRate.stringFromBytePerSec(this.bytePerSec, options);
  }

  /**
   * Implementation of `data-values` custom-encode protocol.
   *
   * @returns {Sexp} Encoded form.
   */
  [BaseConverter.ENCODE]() {
    // Note: This string is included for the convenience of humans who happen to
    // be looking at logs (etc.), but is not actually used when reconstructing
    // an instance.
    const str = this.toString();

    return new Sexp(ByteRate, null, this.bytePerSec, str);
  }


  //
  // Static members
  //

  /**
   * Instance with value of `0`.
   *
   * @type {ByteRate}
   */
  static ZERO = new ByteRate(0);

  /**
   * Multipliers for each named unit to convert to bytes.
   *
   * @type {Map<string, number>}
   */
  static #BYTE_PER_UNIT = new Map(Object.entries({
    'byte/': 1,
    'B/':    1,
    'kB/':   1000,
    'KiB/':  1024,
    'MB/':   1000 ** 2,
    'MiB/':  1024 ** 2,
    'GB/':   1000 ** 3,
    'GiB/':  1024 ** 3,
    'TB/':   1000 ** 4,
    'TiB/':  1024 ** 4
  }));

  /**
   * Multipliers for each named unit to convert to hertz (per-second).
   *
   * @type {Map<string, number>}
   */
  static #UNIT_PER_SEC = Frequency.DENOMINATOR_UNITS;

  /**
   * Parses a string representing a byte data rate, returning an instance of
   * this class. See {@link UnitQuantity#parse} for details on the allowed
   * syntax. The allowed units are as with {@link ByteCount} and
   * {@link Frequency}, except that `hz` / `hertz` is not allowed. Argument
   * values must have both a valid numerator unit and denominator unit to be
   * parsed.
   *
   * @param {string|ByteRate|UnitQuantity} valueToParse The value to parse, or
   *   the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @param {?boolean} [options.allowInstance] Accept instances of this class?
   *   Defaults to `true`.
   * @param {?object} [options.range] Optional range restrictions, in the form
   *   of the argument required by {@link UnitQuantity#isInRange}. If present,
   *   the result of a parse is `null` when the range is not satisfied.
   * @returns {?ByteRate} The parsed byte data rate, or `null` if the value
   *   could not be parsed.
   */
  static parse(valueToParse, options = null) {
    return UnitQuantity.parse(valueToParse, {
      ...(options || {}),
      convert: {
        resultClass: ByteRate,
        unitMaps:    [this.#BYTE_PER_UNIT, this.#UNIT_PER_SEC]
      }
    });
  }

  /**
   * Makes a human-friendly byte-rate string. The result string represents a
   * rounded value, in a format which varies based on the magnitude of the rate.
   * The denominator of the result is always `sec`. The numeric value and
   * numerator are produced as if by {@link ByteCount#stringFromByteCount}.
   *
   * @param {number} byteRate Byte data rate.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.spaces] Use spaces to separate the number from
   *   the units? If `false` an underscore is used.
   * @returns {string} The friendly form.
   */
  static stringFromBytePerSec(byteRate, options = {}) {
    return `${ByteCount.stringFromByteCount(byteRate, options)}/sec`;
  }
}
