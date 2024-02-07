// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf, MustBe } from '@this/typey';


/**
 * General utilities for configuration parsing.
 */
export class Util {
  /**
   * Takes either a string or array of strings, and checks that each one matches
   * a given pattern or passes a given filter.
   *
   * @param {*} items Items to check.
   * @param {string|RegExp|function(string): string} patternOrFilter Pattern or
   *   filter/checker function which must match all the items.
   * @returns {string[]} Frozen copy of the `items` if a `string[]`, frozen
   *   array of just `items` if a simple `string`. If given a filter, the return
   *   value is a frozen array of all the results from calls to the filter.
   * @throws {Error} Thrown if `items` is neither a `string` nor a `string[]`,
   *   or if any of the items failed to match.
   */
  static checkAndFreezeStrings(items, patternOrFilter) {
    if (typeof items === 'string') {
      items = [items];
    } else {
      MustBe.arrayOfString(items);
    }

    let filter;

    if (AskIf.callableFunction(patternOrFilter)) {
      filter = patternOrFilter;
    } else {
      if (typeof patternOrFilter === 'string') {
        patternOrFilter = new RegExp(patternOrFilter);
      } else {
        MustBe.instanceOf(patternOrFilter, RegExp);
      }
      const pattern = patternOrFilter;
      filter = (item) => {
        if (!pattern.test(item)) {
          throw new Error(`String does not match pattern ${pattern}: ${item}`);
        }
        return item;
      };
    }

    const result = items.map(filter);
    return Object.freeze(result);
  }
}
