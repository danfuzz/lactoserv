// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HeaderNames } from '#x/HeaderNames';


/**
 * Subclass of the standard global class `Headers`, with extra functionality
 * found to be useful in practice.
 */
export class HttpHeaders extends Headers {
  /**
   * Constructs an instance.
   *
   * @param {?Headers|Map|object} [other] Initial source of entries. This is
   *   allowed to be anything that implements a map-like iterator, or a plain
   *   object.
   */
  constructor(other = null) {
    super();

    // Note: We don't use the default constructor's ability to initialize from
    // an argument because it does the wrong thing with non-`Headers` objects
    // with array-valued names. (Specifically, it joins them with `,` and not
    // `, `; that is, it doesn't include a space.)

    if (other) {
      this.appendAll(other);
    }
  }

  /**
   * Appends all of the entries in the given other value to this one. In the
   * case of a plain object, this appends its enumerable property values.
   *
   * @param {Headers|Map|object} other Source of entries to append. This is
   *   allowed to be anything that implements a map-like iterator, or a plain
   *   object.
   */
  appendAll(other) {
    const iterator = other[Symbol.iterator]
      ? other[Symbol.iterator]() // Use the defined iterator.
      : Object.entries(other);   // Treat it as a plain object.

    for (const [name, value] of iterator) {
      if (((typeof value) === 'object') && (value !== null)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            this.append(name, v);
          }
        } else {
          throw new Error(`Strange header value: ${value}`);
        }
      } else {
        this.append(name, `${value}`);
      }
    }
  }

  /**
   * Extracts a subset of the headers. Names which aren't found are not listed
   * in the result, and don't cause an error. Extracted values are always
   * simple (pre-combined) strings, except for `Set-Cookies`, which is always
   * an array.
   *
   * @param {...string} names Names of headers to extract.
   * @returns {object} The extracted subset, as a mapping from the given `names`
   *   to their values.
   */
  extract(...names) {
    const result = {};

    for (const n of names) {
      const modName = HeaderNames.modernFrom(n);
      if (modName === 'set-cookie') {
        const cookies = this.getSetCookie();
        if (cookies.length !== 0) {
          result[n] = cookies;
        }
      } else {
        const got = this.get(modName);
        if (got !== null) {
          result[n] = got;
        }
      }
    }

    return result;
  }
}
