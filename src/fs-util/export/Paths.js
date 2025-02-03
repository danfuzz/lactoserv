// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of filesystem stuff.
 */
export class Paths {
  /**
   * Checks that a given value is a string which can be interpreted as an
   * absolute filesystem path. It must start with a slash (`/`), _not_ end with
   * a slash unless it is literally just `/`, and contain _no_ empty components
   * nor `.` or `..` components.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static mustBeAbsolutePath(value) {
    const pattern = '^' +
      '(?!.*/[.]{1,2}/)' + // No dot or double-dot internal component.
      '(?!.*/[.]{1,2}$)' + // No dot or double-dot final component.
      '(?!.*//)' +         // No empty components.
      '(?!.+/$)' +         // No slash at the end (after the first character).
      '/';                 // Starts with a slash.

    try {
      return MustBe.string(value, pattern);
    } catch {
      // Better error message.
      throw new Error(`Not an absolute path: ${value}`);
    }
  }

  /**
   * Checks that a given value is a string which can be interpreted as a plain
   * file name. This allows any non-empty string that has no slashes (`/`),
   * _except_ the two strings `.` ("this directory") and `..` ("the parent
   * directory").
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static mustBeFileName(value) {
    const pattern = /^(?![.]{1,2}$)[^/]+$/;

    try {
      return MustBe.string(value, pattern);
    } catch {
      // Better error message.
      throw new Error(`Not a file name: ${value}`);
    }
  }
}
