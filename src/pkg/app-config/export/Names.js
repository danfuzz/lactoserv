// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of names, including type names.
 */
export class Names {
  /**
   * Checks that a given value is a string which can be used as a "name of
   * something" in this system. Allowed strings must be non-empty and consist
   * only of alphanumerics plus `-`, and furthermore must start and end with an
   * alphanumeric character.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkName(value) {
    const pattern = /^(?!-)[-a-zA-Z0-9]+(?<!-)$/;
    return MustBe.string(value, pattern);
  }

  /**
   * Checks that a given value is a string which can be used as a "type of
   * something" in this system. The allowed pattern is the same as {@link
   * #checkName}; the difference in method name is meant to help signal intent
   * at use sites.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkType(value) {
    return this.checkName(value);
  }
}
