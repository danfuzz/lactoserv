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
   * Checks for type `(string|number)[]`, which is to say values that are valid
   * to use as object or array indices.
   *
   * @param {*} value Arbitrary value.
   * @returns {string[]} `value` if it is of type `(string|number)[]`.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static arrayOfIndex(value) {
    check:
    if ((typeof value === 'object') && (value.constructor === Array)) {
      for (const v of value) {
        const t = typeof v;
        if ((t !== 'string') && (t !== 'number')) {
          break check;
        }
      }
      return value;
    }

    throw new Error('Must be of type `(string|number)[]`.');
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
   * Checks for type `function`.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `value` if it is of type `function`.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static function(value) {
    if (typeof value === 'function') {
      return value;
    }

    throw new Error('Must be of type `function`.');
  }

  /**
   * Checks for type `object`, and optionally being an instance of a particular
   * class.
   *
   * @param {*} value Arbitrary value.
   * @param {?function(new:*, ...*)} [cls = null] Optional class (constructor
   *   function) that `value` must be an instance of.
   * @returns {object} `value` if it is of type `object`, and if specified which
   *   is an instance of `cls`.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static object(value, cls = null) {
    if (typeof value !== 'object') {
      throw new Error('Must be of type `object`.');
    }

    if (cls && !(value instanceof cls)) {
      throw new Error(`Must be instance of class \`${cls.name}\`.`);
    }

    return value;
  }

  /**
   * Checks for type `string`, and optionally matching a particular regular
   * expression.
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
