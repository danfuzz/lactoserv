// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Simple type assertions that can be placed at the starts of methods.
 */
export class MustBe {
  /**
   * Checks for type `*[]`.
   *
   * @param {*} value Arbitrary value.
   * @returns {*[]} `value` if it is of type `*[]`.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static array(value) {
    if ((typeof value === 'object') && (value.constructor === Array)) {
      return value;
    }

    throw new Error('Must be of type `*[]` (array of anything).');
  }

  /**
   * Checks for type `string[]`.
   *
   * @param {*} value Arbitrary value.
   * @returns {string[]} `value` if it is of type `string[]`.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static arrayOfString(value) {
    check:
    if ((typeof value === 'object') && (value.constructor === Array)) {
      for (const v of value) {
        if (typeof v !== 'string') {
          break check;
        }
      }
      return value;
    }

    throw new Error('Must be of type `string[]`.');
  }

  /**
   * Checks for type `boolean`.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `value` if it is of type `boolean`.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static boolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    throw new Error('Must be of type `boolean`.');
  }

  /**
   * Checks for type `string`.
   *
   * @param {*} value Arbitrary value.
   * @param {?RegExp} [match = null] Optional regular expression that `value`
   *   must match.
   * @returns {string} `value` if it is of type `string`, and if specified which
   *   matches `match`.
   * @throws {Error} Thrown if `value` is of any other type or doesn't match.
   */
  static string(value, match = null) {
    if (typeof value !== 'string') {
      throw new Error('Must be of type `string`.');
    }

    if (match && !match.test(value)) {
      throw new Error(`Must match pattern: ${match}`);
    }

    return value;
  }
}
