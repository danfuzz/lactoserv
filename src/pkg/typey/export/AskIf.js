// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

/**
 * Simple type checks. Each one is a predicate (boolean-returning function).
 * These are all similar to the name-named methods in {@link MustBe}, except
 * the latter are assertions.
 *
 * **Note:** The intention is that this class and {@link MustBe} contain all the
 * same methods, except where a method in this class would be redundant with a
 * standard JavaScript predicate.
 */
export class AskIf {
  // Note: No method `array()`, because of the standard `Array.isArray()`.

  /**
   * Checks for type `(string|number)[]`, which is to say an array of values
   * that are all valid to use as object or array indices.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static arrayOfIndex(value) {
    if (!Array.isArray(value)) {
      return false;
    }

    for (const v of value) {
      const t = typeof v;
      if ((t !== 'string') && (t !== 'number')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks for type `string[]`.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static arrayOfString(value) {
    if (!Array.isArray(value)) {
      return false;
    }

    for (const v of value) {
      if (typeof v !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks for type `object[]`, where each item must furthermore be a _plain_
   * object (i.e. not an instance of anything other than `Object` itself.)
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static arrayOfPlainObject(value) {
    if (!Array.isArray(value)) {
      return false;
    }

    for (const v of value) {
      if (!AskIf.plainObject(v)) {
        return false;
      }
    }

    return true;
  }

  // Note: No method `boolean()`, because of the standard `typeof v ===
  // 'boolean'`.

  // TODO: callableFunction()

  // Note: No method `function()`, because of the standard `typeof v ===
  // 'function'`.

  // Note: No method `null()`, because of the standard `v === null`.

  // TODO: number()

  /**
   * Checks for type `object`, which must furthermore be a _plain_ object
   * (direct instance of `Object` per se).
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static plainObject(value) {
    return (value !== null)
      && (typeof value === 'object')
      && Object.getPrototypeOf(value) === Object.prototype;
      throw new Error('Must be of type plain `object`.');
  }

  // Note: No method `object()`, because of the standards `v instanceof Class`
  // and `typeof v === 'object'`.

  // TODO: string()
}
