// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { Duration } from '#x/Duration';
import { UnitQuantity } from '#x/UnitQuantity';


/**
 * Representation of a frequency, that is, a rate of time. This class allows
 * negative values; though not useful all the time, there's arguably at least
 * some utility to them.
 *
 * Instances of this class are always frozen.
 */
export class Frequency extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} hertz The frequency to represent, in hertz (that is, as an
   *   inverse of seconds). Must be finite.
   */
  constructor(hertz) {
    super(hertz, null, 'sec');
  }

  /** @override */
  get [UnitQuantity.INVERSE]() {
    return Duration;
  }

  /**
   * @returns {number} The frequency being represented, in hertz (that is,
   * inverse seconds).
   */
  get hertz() {
    return this.value;
  }


  //
  // Static members
  //

  /**
   * Instance with value of `0`.
   *
   * @type {Frequency}
   */
  static ZERO = new Frequency(0);

  /**
   * Multipliers for each named unit to convert to hertz.
   *
   * @type {Map<string, number>}
   */
  static #UNIT_PER_SEC = new Map(Object.entries({
    '/ns':     1_000_000_000,
    '/nsec':   1_000_000_000,
    '/us':     1_000_000,
    '/usec':   1_000_000,
    '/ms':     1_000,
    '/msec':   1_000,
    '/s':      1,
    '/sec':    1,
    '/second': 1,
    'hz/':     1,
    'hertz/':  1,
    '/m':      (1 / 60),
    '/min':    (1 / 60),
    '/minute': (1 / 60),
    '/h':      (1 / (60 * 60)),
    '/hr':     (1 / (60 * 60)),
    '/hour':   (1 / (60 * 60)),
    '/d':      (1 / (60 * 60 * 24)),
    '/day':    (1 / (60 * 60 * 24))
  }));

  /**
   * Parses a string representing a frequency, returning an instance of this
   * class. See {@link UnitQuantity#parse} for details on the allowed syntax.
   * The allowed units are:
   *
   * * `/ns` or `/nsec` -- per nanosecond
   * * `/us` or `/usec` -- per microsecond
   * * `/ms` or `/msec` -- per millisecond
   * * `/s`, `/sec`, `hz`, or `hertz` -- per second
   * * `/m` or `/min` or `minute` -- per minute
   * * `/h` or `/hr` or `hour` -- per hour
   * * `/d` or `/day` -- per day (defined as exactly once per 24 hours)
   *
   * @param {string|Frequency|UnitQuantity} valueToParse The value to parse, or
   *   the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @param {?boolean} [options.allowInstance] Accept instances of this class?
   *   Defaults to `true`.
   * @param {?object} [options.range] Optional range restrictions, in the form
   *   of the argument required by {@link UnitQuantity#isInRange}. If present,
   *   the result of a parse is `null` when the range is not satisfied.
   * @returns {?Frequency} The parsed frequency, or `null` if the value could
   *   not be parsed.
   */
  static parse(valueToParse, options = null) {
    const {
      allowInstance = true,
      range         = null
    } = options ?? {};

    const result = UnitQuantity.parse(valueToParse, {
      allowInstance,
      convert: {
        resultUnit: '/sec',
        unitMaps:   [this.#UNIT_PER_SEC]
      },
      ...(range ? { range } : null)
    });

    console.log('######### XXX', result);

    return ((result === null) || (result instanceof Frequency))
      ? result
      : new Frequency(result.value);
  }
}
