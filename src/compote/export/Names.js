// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of names, including type names.
 */
export class Names {
  /**
   * Checks that a given value is a string which can be used as a "name of
   * something" in this system. Allowed strings must be non-empty and consist
   * only of alphanumerics plus any of `-_.+`, and furthermore must start and
   * end with an alphanumeric character or `_`.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkName(value) {
    if (this.isName(value)) {
      return value;
    }

    throw new Error(`Invalid component name: ${value}`);
  }

  /**
   * Checks whether or not a given value is a string which can be used as a
   * "name of something" in this system. Allowed strings must be non-empty and
   * consist only of alphanumerics plus any of `-_.+`, and furthermore must
   * start and end with an alphanumeric character or `_`.
   *
   * @param {string} value Value in question.
   * @returns {boolean} `true` if it is a string which matches the stated
   *   pattern, or `false` if not.
   * @throws {Error} Thrown if `value` is not even a string.
   */
  static isName(value) {
    MustBe.string(value);

    const pattern = /^(?![-.])[-_.+a-zA-Z0-9]+(?<![-.])$/;
    return pattern.test(value);
  }

  /**
   * Parses an absolute component path from a slash-separated list of elements,
   * which must begin with a slash.
   *
   * @param {string} path The absolute path to parse.
   * @returns {TreePathKey} The parsed path.
   */
  static parsePath(path) {
    MustBe.string(path);

    const elements = path.split('/');
    const len      = elements.length;

    if ((len < 2) || (elements[0] !== '')) {
      throw new Error(`Not an absolute component path: ${path}`);
    }

    elements.pop(); // Drop the initial empty element.

    for (const e of elements) {
      if (!this.isName(e)) {
        throw new Error(`Not an absolute component path: ${path}`);
      }
    }

    // `Object.freeze()` means `TreePathKey` can avoid making a copy.
    return new TreePathKey(Object.freeze(elements), false);
  }
}
