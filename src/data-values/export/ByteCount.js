// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConverter } from '#x/BaseConverter';
import { Sexp } from '#x/Sexp';
import { UnitQuantity } from '#x/UnitQuantity';


/**
 * Representation of a quantity of data, in units of bytes. That said, this
 * class allows fractional values. Also, this class allows negative values;
 * though not useful all the time, there's arguably at least some utility to
 * them.
 *
 * Instances of this class are always frozen.
 */
export class ByteCount extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} byte The number of bytes. Must be finite.
   */
  constructor(byte) {
    super(byte, 'byte', null);
  }

  /** @returns {number} The number of bytes being represented. */
  get byte() {
    return this.value;
  }

  /**
   * Makes a human-friendly string representing this instance. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the value.
   *
   * @param {object} [options] Formatting options, as with
   *   {@link #stringFromByteCount}.
   * @returns {string} The friendly form.
   */
  toString(options = {}) {
    return ByteCount.stringFromByteCount(this.byte, options);
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

    return new Sexp(ByteCount, null, this.byte, str);
  }


  //
  // Static members
  //

  /**
   * Instance with value of `0`.
   *
   * @type {ByteCount}
   */
  static ZERO = new ByteCount(0);

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
   * Parses a string representing a byte count, returning an instance of this
   * class. See {@link UnitQuantity#parse} for details on the allowed syntax.
   * The allowed units are:
   *
   * * `byte` or `B` -- bytes
   * * `kB` -- kilobytes (bytes * 1000)
   * * `MB` -- megabytes (bytes * 1000^2)
   * * `GB` -- gigabytes (bytes * 1000^3)
   * * `TB` -- terabytes (bytes * 1000^4)
   * * `KiB` -- kibibytes (bytes * 1024)
   * * `MiB` -- mebibytes (bytes * 1024^2)
   * * `GiB` -- gibibytes (bytes * 1024^3)
   * * `TiB` -- tebibytes (bytes * 1024^4)
   *
   * @param {string|ByteCount|UnitQuantity} valueToParse The value to parse, or
   *   the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @param {?boolean} [options.allowInstance] Accept instances of this class?
   *   Defaults to `true`.
   * @param {?object} [options.range] Optional range restrictions, in the form
   *   of the argument required by {@link UnitQuantity#isInRange}. If present,
   *   the result of a parse is `null` when the range is not satisfied.
   * @returns {?ByteCount} The parsed byte count, or `null` if the value could
   *   not be parsed.
   */
  static parse(valueToParse, options = null) {
    return UnitQuantity.parse(valueToParse, {
      ...(options || {}),
      convert: {
        resultClass: ByteCount,
        unitMaps:    [this.#BYTE_PER_UNIT]
      }
    });
  }

  /**
   * Makes a human-friendly byte-count string. The result string represents a
   * rounded value, in a format which varies based on the magnitude of the
   * count. The result uses either `B` to denote bytes or one of the
   * binary-count prefixes `KiB`, `MiB`, `GiB`, or `TiB`. In the latter cases
   * the return value uses two digits after a decimal point unless the value is
   * an exact integer. The dividing line between `B` and `kB` is at 99999/100000
   * bytes. The dividing line between `KiB` and `MiB` is at 9999/10000
   * kibibytes; this is similar with the larger units too.
   *
   * @param {?number} byteCount Number of bytes. If passed as `null`, this
   *   method returns `<none>`.
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.spaces] Use spaces to separate the number from
   *   the units? If `false` an underscore is used.
   * @returns {string} The friendly form.
   */
  static stringFromByteCount(byteCount, options = {}) {
    const { spaces = true } = options;
    const spaceyChar        = spaces ? ' ' : '_';
    const neg               = (byteCount < 0) ? '-' : '';

    if (byteCount < 0) {
      byteCount = -byteCount;
    }

    if (byteCount === null) {
      return '<none>';
    } else if (byteCount < 100000) {
      return Number.isInteger(byteCount)
        ? `${neg}${byteCount}${spaceyChar}B`
        : `${neg}${byteCount.toFixed(2)}${spaceyChar}B`;
    } else if (byteCount < (10000 * 1024)) {
      const kibibytes = byteCount / 1024;
      return Number.isInteger(kibibytes)
        ? `${neg}${kibibytes}${spaceyChar}KiB`
        : `${neg}${kibibytes.toFixed(2)}${spaceyChar}KiB`;
    } else if (byteCount < (10000 * 1024**2)) {
      const mebibytes = byteCount / (1024 ** 2);
      return Number.isInteger(mebibytes)
        ? `${neg}${mebibytes}${spaceyChar}MiB`
        : `${neg}${mebibytes.toFixed(2)}${spaceyChar}MiB`;
    } else if (byteCount < (10000 * 1024**3)) {
      const gibibytes = byteCount / (1024 ** 3);
      return Number.isInteger(gibibytes)
        ? `${neg}${gibibytes}${spaceyChar}GiB`
        : `${neg}${gibibytes.toFixed(2)}${spaceyChar}GiB`;
    } else {
      const tebibytes = byteCount / (1024 ** 4);
      return Number.isInteger(tebibytes)
        ? `${neg}${tebibytes}${spaceyChar}TiB`
        : `${neg}${tebibytes.toFixed(2)}${spaceyChar}TiB`;
    }
  }
}
