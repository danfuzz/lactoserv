// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { UnitQuantity } from '@this/quant';


/**
 * Representation of a count of requests.
 */
export class RequestCount extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} request The count of requests. Must be finite.
   */
  constructor(request) {
    super(request, 'req', null);
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
   * Parses a string representing a request count. See
   * {@link UnitQuantity#parse} for details.
   *
   * @param {string|RequestCount|UnitQuantity} valueToParse The value to parse,
   *   or the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @returns {?RequestCount} The parsed count, or `null` if the value could not
   *   be parsed.
   */
  static parse(valueToParse, options = null) {
    return UnitQuantity.parse(valueToParse, {
      ...(options || {}),
      convert: {
        resultClass: RequestCount,
        unitMaps:    [this.#REQUEST_PER_UNIT]
      }
    });
  }
}
