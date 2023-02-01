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
   * Checks for type "string value which can be an array index." This accursed
   * method is useful when doing introspection on arrays.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static arrayIndexString(value) {
    if (typeof value !== 'string') {
      return false;
    }

    const intValue = parseInt(value);

    return (intValue.toString() === value)
      && (intValue >= 0)
      && (intValue < (2 ** 32));
  }

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

  /**
   * Checks for type "callable function," that is whether the given value is a
   * function which is furthermore usable for direct function calls. The type
   * name notwithstanding, in JavaScript some "functions" can't actually be
   * called (they can only be used as constructors).
   *
   * **Note:** Unfortunately, JavaScript (a) is loosey-goosey about what sorts
   * of functions can be called, and (b) doesn't provide a way
   * to distinguish the various cases _except_ to look at the string conversion
   * of functions. This method errs on the side of over-acceptance.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static callableFunction(value) {
    if ((typeof value) !== 'function') {
      return false;
    }

    // It's a function. Now we need to know if it's callable by looking at the
    // string form. The only variant that is definitely _not_ callable is a
    // modern class, which will have the prefix `class ` (with a space).
    //
    // **Note:** We call the `toString()` of the `Function` prototype, to
    // avoid getting fooled by functions that override that method.

    const s = Function.prototype.toString.call(value);
    if (/^class /.test(s)) {
      return false;
    }

    return true;
  }

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
  }

  // Note: No method `instanceOf()`, because of the standard `v instanceof
  // Class`.

  // TODO: string()
}
