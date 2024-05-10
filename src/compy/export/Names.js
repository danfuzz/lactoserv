// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
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
   * * a `PathKey` -- Returned directly if not a wildcard or if a wildcard and
   *   `allowWildcard === true`, otherwise is an error. Elements are checked for
   *   validity.
   * * an array of strings -- Contructed into, with elements checked for
   *   validity. If `allowWildcard === true`, a final element of `*` indicates a
   *   wildcard.
   * * a string -- Parsed as a slash--separated list of elements, which must
   *   begin with a slash. Elements are checked for validity. If `allowWildcard
   *   === true`, a final element of `*` indicates a wildcard.
   *
   * @param {string|Array<string>|PathKey} path The absolute path to parse.
   * @param {boolean} [allowWildcard] Allow wildcard paths?
   * @returns {PathKey} The parsed path.
   */
  static parsePath(path, allowWildcard = false) {
    // Note: All the `freeze()`ing is so that `new PathKey()` can avoid making a
    // copy of the path arrays.

    if (Array.isArray(path)) {
      const len = path.length;
      if ((len >= 1) && (path[len - 1] === '*')) {
        if (!allowWildcard) {
          throw new Error('Wildcard not allowed.');
        }
        path = new PathKey(Object.freeze(path.slice(0, len - 1)), true);
      } else {
        path = new PathKey(path, false);
      }
    } else if (typeof path === 'string') {
      const elements = path.split('/');
      const len      = elements.length;

      if ((len < 2) || (elements[0] !== '')) {
        throw new Error(`Not an absolute component path: ${path}`);
      }

      const isWildcard = (elements[len - 1] === '*');

      if (isWildcard) {
        if (!allowWildcard) {
          throw new Error(`Wildcard not allowed: ${path}`);
        }
        elements.pop(); // Drop the wildcard element.
      }

      // Drop the initial empty element.
      elements.shift();

      if ((elements.length === 1) && (elements[0] === '')) {
        // It's the root path.
        elements.pop();
      }

      path = new PathKey(Object.freeze(elements), isWildcard);
    } else if (path instanceof PathKey) {
      if (path.wildcard && !allowWildcard) {
        throw new Error(`Wildcard not allowed: \`${this.pathStringFrom(path)}\``);
      }
    } else {
      throw new Error(`Not an absolute component path: ${path}`);
    }

    for (const p of path.path) {
      if (!this.isName(p)) {
        throw new Error(`Not a valid component name: \`${p}\`, in \`${this.pathStringFrom(path)}\``);
      }
    }

    return (allowWildcard) ? path : path.withWildcard(false);
  }

  /**
   * Like {@link #parsePath}, but allows `null` and `undefined` which both cause
   * the method to return `null`. Other invalid inputs still cause an error to
   * be thrown.
   *
   * @param {?string|Array<string>|PathKey} path The absolute path to parse.
   * @param {boolean} [allowWildcard] Allow wildcard paths?
   * @returns {?PathKey} The parsed path, or `null`.
   */
  static parsePathOrNull(path, allowWildcard = false) {
    if ((path === null) || (path === undefined)) {
      return null;
    } else {
      return this.parsePath(path, allowWildcard);
    }
  }

  /**
   * Returns the string form of an absolute name path key. That is, this is the
   * reverse of {@link #parsePath}.
   *
   * @param {PathKey} key The absolute path key.
   * @returns {string} The string form.
   */
  static pathStringFrom(key) {
    MustBe.instanceOf(key, PathKey);

    return key.toString({
      prefix:    '/',
      separator: '/',
      suffix:    ''
    });
  }
}
