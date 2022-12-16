// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * General utilities for configuration parsing.
 */
export class Util {
  /**
   * Takes either a string or array of strings, and checks that each one matches
   * a given pattern.
   *
   * @param {*} items Items to check.
   * @param {string|RegExp} pattern Pattern which must match all the items.
   * @returns {string[]} Frozen copy of the original `items` if a `string[]`,
   *   frozen array of just `items` if a simple `string`, as long as all items
   *   matched the `pattern`.
   * @throws {Error} Thrown if `items` is neither a `string` nor a `string[]`,
   *   or if any of the items failed to match `pattern`.
   */
  static checkAndFreezeStrings(items, pattern) {
    if (typeof items === 'string') {
      items = [items];
    } else {
      MustBe.arrayOfString(items);
    }

    if (typeof pattern === 'string') {
      pattern = new RegExp(pattern);
    } else {
      MustBe.object(pattern, RegExp);
    }

    for (const item of items) {
      if (!pattern.test(item)) {
        throw new Error(`String does not match pattern ${pattern}: ${item}`);
      }
    }

    return Object.freeze([...items]);
  }
}
