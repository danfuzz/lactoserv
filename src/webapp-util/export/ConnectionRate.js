// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Frequency, UnitQuantity } from '@this/data-values';


/**
 * Representation of a rate of connections, in units of (possibly fractional)
 * connections per second.
 */
export class ConnectionRate extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} connectionPerSec The number of connections per second. Must
   *   be finite.
   */
  constructor(connectionPerSec) {
    super(connectionPerSec, 'conn', 'sec');
  }


  //
  // Static members
  //

  /**
   * Multipliers for each named unit to convert to connections.
   *
   * @type {Map<string, number>}
   */
  static #CONNECTION_PER_UNIT = new Map(Object.entries({
    'connection/': 1,
    'conn/':       1,
    'c/':          1
  }));

  /**
   * Multipliers for each named unit to convert to hertz (per-second).
   *
   * @type {Map<string, number>}
   */
  static #UNIT_PER_SEC = Frequency.DENOMINATOR_UNITS;

  /**
   * Parses a string representing a connection rate. See
   * {@link UnitQuantity#parse} for details.
   *
   * @param {string|ConnectionRate|UnitQuantity} valueToParse The value to
   *   parse, or the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @returns {?ConnectionRate} The parsed rate, or `null` if the value could
   *   not be parsed.
   */
  static parse(valueToParse, options = null) {
    return UnitQuantity.parse(valueToParse, {
      ...(options || {}),
      convert: {
        resultClass: ConnectionRate,
        unitMaps:    [this.#CONNECTION_PER_UNIT, this.#UNIT_PER_SEC]
      }
    });
  }
}
