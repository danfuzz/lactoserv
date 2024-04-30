// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { UnitQuantity } from '@this/data-values';


/**
 * Representation of a count of connections.
 */
export class ConnectionCount extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} connection The count of connections. Must be finite.
   */
  constructor(connection) {
    super(connection, 'conn', null);
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
   * Parses a string representing a connection count. See {@link
   * UnitQuantity#parse} for details.
   *
   * @param {string|ConnectionCount|UnitQuantity} valueToParse The value to
   *   parse, or the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @returns {?ConnectionCount} The parsed count, or `null` if the value could
   *   not be parsed.
   */
  static parse(valueToParse, options = null) {
    return UnitQuantity.parse(valueToParse, {
      ...(options || {}),
      convert: {
        resultClass: ConnectionCount,
        unitMaps:    [this.#CONNECTION_PER_UNIT]
      }
    });
  }
}
