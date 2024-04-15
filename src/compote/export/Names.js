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
   * Parses an absolute component path into a key. This accepts all of:
   *
   * * a `TreePathKey` -- Returned directly if not a wildcard, otherwise returns
   *   the non-wildcard version. Elements are checked for validity.
   * * an array of strings -- Contructed into a non-wildcard-key, with elements
   *   checked for validity.
   * * a string -- Parsed as a slash--separated list of elements, which must
   *   begin with a slash. Elements are checked for validity.
   *
   * @param {string|Array<string>|TreePathKey} path The absolute path to parse.
   * @returns {TreePathKey} The parsed path.
   */
  static parsePath(path) {
    if (Array.isArray(path)) {
      path = new TreePathKey(path, false);
    } else if (typeof path === 'string') {
      const elements = path.split('/');
      const len      = elements.length;

      if ((len < 2) || (elements[0] !== '')) {
        throw new Error(`Not an absolute component path: ${path}`);
      }

      // Drop the initial empty element, and freeze so `TreePathKey` can avoid
      // making a copy.
      Object.freeze(elements.pop());

      path = new TreePathKey(elements, false);
    } else if (!(path instanceof TreePathKey)) {
      throw new Error(`Not an absolute component path: ${path}`);
    }

    for (const p of path.path) {
      if (!this.isName(p)) {
        throw new Error(`Not a valid component name: ${p}, in ${this.pathStringFrom(path)}`);
      }
    }

    return path.withWildcard(false);
  }

  /**
   * Like {@link #parsePath}, but allows `null` and `undefined` which both
   * cause the method to return `null`. Other invalid inputs still cause an
   * error to be thrown.
   *
   * @param {?string|Array<string>|TreePathKey} path The absolute path to parse.
   * @returns {?TreePathKey} The parsed path, or `null`.
   */
  static parsePathOrNull(path) {
    if ((path === null) || (path === undefined)) {
      return null;
    } else {
      return this.parsePath(path);
    }
  }

  /**
   * Returns the string form of an absolute name path key. That is, this is the
   * reverse of {@link #parsePath}.
   *
   * @param {TreePathKey} key The absolute path key.
   * @returns {string} The string form.
   */
  static pathStringFrom(key) {
    MustBe.instanceOf(key, TreePathKey);

    return key.toString({
      prefix:    '/',
      separator: '/',
      suffix:    ''
    });
  }
}
