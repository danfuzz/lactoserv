// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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
    if (Array.isArray(value)) {
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
    if (Array.isArray(value)) {
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
    if (Array.isArray(value)) {
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
   * Checks for type `object[]`, where each item must furthermore be a _plain_
   * object (i.e. not an instance of anything other than `Object` itself.)
   *
   * @param {*} value Arbitrary value.
   * @returns {object[]} `value` if it is of type `object[]`, with all plain
   *   objects.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static arrayOfPlainObject(value) {
    check:
    if (Array.isArray(value)) {
      for (const v of value) {
        if (!MustBe.plainObject(v)) {
          break check;
        }
      }
      return value;
    }

    throw new Error('Must be of type `object[]`, with all plain objects.');
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
   * Indicates whether the given value is a function which is furthermore usable
   * for direct function calls. The type name notwithstanding, in JavaScript
   * some "functions" can't actually be called (they can only be used as
   * constructors).
   *
   * **Note:** Unfortunately, JavaScript (a) is loosey-goosey about what sorts
   * of functions can be called, and (b) doesn't provide a way
   * to distinguish the various cases _except_ to look at the string conversion
   * of functions. This method errs on the side of over-acceptance.
   *
   * @param {*} value Value in question.
   * @returns {function(*)} `value` if it is a callable function.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static callableFunction(value) {
    if ((typeof value) === 'function') {
      // It's a function. Now we need to know if it's callable by looking at the
      // string form. The only variant that is definitely _not_ callable is a
      // modern class, which will have the prefix `class ` (with a space).
      //
      // **Note:** We call the `toString()` of the `Function` prototype, to
      // avoid getting fooled by functions that override that method.

      const s = Function.prototype.toString.call(value);
      if (!(/^class /.test(s))) {
        return value;
      }
    }

    throw new Error('Must be of type `callable-function`.');
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
   * Checks for the value `null`.
   *
   * @param {*} value Arbitrary value.
   * @returns {null} `null` if `value === null`.
   * @throws {Error} Thrown if `value` is anything else.
   */
  static null(value) {
    if (value === null) {
      return null;
    }

    throw new Error('Must be the value `null`.');
  }

  /**
   * Checks for type `number`, which may optionally be restricted further.
   * Options:
   *
   * * `{boolean} finite` -- If `true`, requires `value` to be finite.
   * * `{number} maxExclusive` -- Exclusive maximum value. That is,
   *   `value < maxExclusive` is required.
   * * `{number} maxInclusive` -- Inclusive maximum value. That is,
   *   `value <= maxInclusive` is required.
   * * `{number} minExclusive` -- Exclusive minimum value. That is,
   *   `value > minExclusive` is required.
   * * `{number} minInclusive` -- Inclusive minimum value. That is,
   *   `value > minInclusive` is required.
   * * `{boolean} safeInteger` -- If `true`, requires `value` to be a safe
   *   integer (exactly representable integer as a regular JavaScript number).
   *   Implies `finite`.
   *
   * @param {*} value Arbitrary value.
   * @param {?object} [options = null] Options, per the above description.
   * @returns {number} `value` if it is a number which meets all the given
   *   optional restrictions.
   * @throws {Error} Thrown if `value` is of any other type or does not meet the
   *   optional restrictions.
   */
  static number(value, options = null) {
    if (typeof value !== 'number') {
      throw new Error('Must be of type `number`.');
    }

    const {
      finite = false,
      maxExclusive = null,
      maxInclusive = null,
      minExclusive = null,
      minInclusive = null,
      safeInteger = false
    } = options ?? {};

    if (safeInteger) {
      if (!Number.isSafeInteger(value)) {
        throw new Error('Must be of type `number` and a safe integer.');
      }
    } else if (finite) {
      if (!Number.isFinite(value)) {
        throw new Error('Must be of type `number` and finite.');
      }
    }

    if (!(   ((minExclusive === null) || (value > minExclusive))
          && ((minInclusive === null) || (value >= minInclusive))
          && ((maxExclusive === null) || (value < maxExclusive))
          && ((maxInclusive === null) || (value <= maxInclusive)))) {
      throw new Error('Must be of type `number` in specified range.');
    }

    return value;
  }

  /**
   * Checks for type `object`, which must furthermore be a _plain_ object
   * (direct instance of `Object` per se).
   *
   * @param {*} value Arbitrary value.
   * @returns {object} `value` if it is of type `object` and is furthermore a
   *   plain object.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static plainObject(value) {
    if (   (value === null)
        || (typeof value !== 'object')
        || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error('Must be of type plain `object`.');
    }

    return value;
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
   * @param {?RegExp|string} [match = null] Optional regular expression that
   *  `value` must match.
   * @returns {string} `value` if it is of type `string`, and if specified which
   *   matches `match`.
   * @throws {Error} Thrown if `value` is of any other type or doesn't match.
   */
  static string(value, match = null) {
    if (typeof value !== 'string') {
      throw new Error('Must be of type `string`.');
    }

    if (match) {
      if (typeof match === 'string') {
        match = new RegExp(match);
      }
      if (!match.test(value)) {
        throw new Error(`Must match pattern: ${match}`);
      }
    }

    return value;
  }
}
