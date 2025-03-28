// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf } from '#x/AskIf';
import { MustBe } from '#x/MustBe';


/**
 * General utilities for strings.
 */
export class StringUtil {
  /**
   * Takes either a string or array of strings, and checks that each one matches
   * a given pattern, is contained in a given set, or passes a given filter.
   *
   * @param {*} items Items to check.
   * @param {string|Set|RegExp|function(string): string} patternOrFilter Pattern
   *   or filter/checker function which must match all the items. If passed a
   *   string, it is interpreted as a regex.
   * @returns {Array<string>} Frozen copy of the `items` if a `string[]`, frozen
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

    if (patternOrFilter instanceof Set) {
      const set = patternOrFilter;
      filter = (item) => {
        if (!set.has(item)) {
          const setStr = `[${[...set].join(', ')}]`;
          throw new Error(`String is not in set ${setStr}: ${item}`);
        }
        return item;
      };
    } else if (AskIf.callableFunction(patternOrFilter)) {
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
