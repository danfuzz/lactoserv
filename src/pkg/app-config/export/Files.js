// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of filesystem stuff.
 */
export class Files {
  /**
   * @returns {string} Regex pattern for an absolute filesystem path. It is
   * anchored at both ends so as to only match complete strings.
   */
  static get ABSOLUTE_PATH_PATTERN() {
    return '^' +
      '(?!.*/[.]{1,2}/)' + // No dot or double-dot internal component.
      '(?!.*/[.]{1,2}$)' + // No dot or double-dot final component.
      '(?!.*//)' +         // No empty components.
      '(?!.*/$)' +         // No slash at the end.
      '/[^/]';             // Starts with a slash. Has at least one component.
  }

  /**
   * @returns {string} Regex pattern for a plain file name (no directories),
   * anchored at both ends so as to only match complete strings. This allows
   * any non-empty string that has no slashes (`/`), _except_ the two strings
   * `.` ("this directory") and `..` ("the parent directory").
   */
  static get FILE_NAME_PATTERN() {
    return '^(?![.]{1,2}$)[^/]+$';
  }

  /**
   * Checks that a given value is a string matching {@link
   * #ABSOLUTE_PATH_PATTERN}.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkAbsolutePath(value) {
    return MustBe.string(value, this.ABSOLUTE_PATH_PATTERN);
  }

  /**
   * Checks that a given value is a string matching {@link
   * #FILE_NAME_PATTERN}.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkFileName(value) {
    return MustBe.string(value, this.FILE_NAME_PATTERN);
  }
}
