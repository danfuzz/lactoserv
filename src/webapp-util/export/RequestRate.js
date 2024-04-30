// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Frequency, UnitQuantity } from '@this/data-values';


/**
 * Representation of a rate of requests, in units of (possibly fractional)
 * requests per second.
 */
export class RequestRate extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} requestPerSec The number of requests per second. Must be
   * finite.
   */
  constructor(requestPerSec) {
    super(requestPerSec, 'req', 'sec');
  }


  //
  // Static members
  //

  /**
   * Multipliers for each named unit to convert to requests.
   *
   * @type {Map<string, number>}
   */
  static #REQUEST_PER_UNIT = new Map(Object.entries({
    'request/': 1,
    'req/':     1,
    'r/':       1
  }));

  /**
   * Multipliers for each named unit to convert to hertz (per-second).
   *
   * @type {Map<string, number>}
   */
  static #UNIT_PER_SEC = Frequency.DENOMINATOR_UNITS;

  /**
   * Parses a string representing a request rate. See {@link UnitQuantity#parse}
   * for details.
   *
   * @param {string|RequestRate|UnitQuantity} valueToParse The value to parse,
   *   or the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @returns {?RequestRate} The parsed rate, or `null` if the value could not
   *   be parsed.
   */
  static parse(valueToParse, options = null) {
    return UnitQuantity.parse(valueToParse, {
      ...(options || {}),
      convert: {
        resultClass: RequestRate,
        unitMaps:    [this.#REQUEST_PER_UNIT, this.#UNIT_PER_SEC]
      }
    });
  }
}
