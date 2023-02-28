// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf } from '#x/AskIf';


/**
 * Simple type assertions that can be placed at the starts of methods. Each
 * method either returns the originally-passed value or throws an error
 * indicating the type was not as expected. These are all similar to the
 * name-named methods in {@link AskIf}, except the latter are predicates.
 *
 * **Note:** The intention is that this class and {@link AskIf} contain all the
 * same methods, except where a method in the latter class would be redundant
 * with a standard JavaScript predicate.
 */
export class MustBe {
  /**
   * Checks for type `*[]` (array of anything).
   *
   * @param {*} value Arbitrary value.
   * @returns {*[]} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static array(value) {
    if (Array.isArray(value)) {
      return value;
    }

    throw new Error('Must be of type `*[]` (array of anything).');
  }

  /**
   * Checks for type `array`, where each element must be of a particular type,
   * specified as a predicate.
   *
   * @param {*} value Arbitrary value.
   * @param {function(*): boolean} predicate Predicate to match.
   * @returns {*[]} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static arrayOf(value, predicate) {
    if (AskIf.arrayOf(value, predicate)) {
      return value;
    }

    throw new Error('Must be of type `array` of a particular type.');
  }

  /**
   * Checks for type `string[]`.
   *
   * @param {*} value Arbitrary value.
   * @returns {string[]} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static arrayOfString(value) {
    if (AskIf.arrayOfString(value)) {
      return value;
    }

    throw new Error('Must be of type `string[]`.');
  }

  /**
   * Checks for type `object[]`, where each item must furthermore be a _plain_
   * object (i.e. not an instance of anything other than `Object` itself.)
   *
   * @param {*} value Arbitrary value.
   * @returns {object[]} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static arrayOfPlainObject(value) {
    if (AskIf.arrayOfPlainObject(value)) {
      return value;
    }

    throw new Error('Must be of type `object[]`, with all plain objects.');
  }

  /**
   * Checks for type `boolean`.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static boolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    throw new Error('Must be of type `boolean`.');
  }

  /**
   * Checks for type "callable function." See {@link AskIf#callableFunction} for
   * details.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static callableFunction(value) {
    if (AskIf.callableFunction(value)) {
      return value;
    }

    throw new Error('Must be of type "callable function."');
  }

  /**
   * Checks for type "constructor function" (a/k/a "class"). See {@link
   * AskIf#constructorFunction} for details.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static constructorFunction(value) {
    if (AskIf.constructorFunction(value)) {
      return value;
    }

    throw new Error('Must be of type "constructor function" (a/k/a "class").');
  }

  /**
   * Checks for type `function`.
   *
   * @param {*} value Arbitrary value.
   * @returns {Function} `value` if it is of the indicated type.
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
   * @returns {null} `value` if it is of the indicated type.
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
   *
   * @param {*} value Arbitrary value.
   * @param {?object} [options = null] Options for restrictions.
   * @param {boolean} [options.finite = false] Must `value` be finite?
   * @param {?number} [options.maxExclusive = null] Exclusive maximum value.
   *   That is, require `value < maxExclusive`.
   * @param {?number} [options.maxInclusive = null] Inclusive maximum value.
   *   That is, require `value <= maxInclusive`.
   * @param {?number} [options.minExclusive = null] Exclusive minimum value.
   *   That is, require `value > minExclusive`.
   * @param {?number} [options.minInclusive = null] Inclusive minimum value.
   *   That is, require `value > minInclusive`.
   * @param {boolean} [options.safeInteger = false] Must `value` be a safe
   *   integer (exactly representable integer as a regular JavaScript number).
   *   Implies `options.finite: true`.
   * @returns {number} `value` if it is of the indicated type.
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
   * @returns {object} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static plainObject(value) {
    if (AskIf.plainObject(value)) {
      return value;
    }

    throw new Error('Must be of type plain `object`.');
  }

  /**
   * Checks for type `object` and specifically being an instance of a particular
   * class.
   *
   * @param {*} value Arbitrary value.
   * @param {function(new:*, ...*)} [cls = null] Class (constructor function)
   *   `value` must be an instance of.
   * @returns {object} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static instanceOf(value, cls) {
    if (value instanceof cls) {
      return value;
    }

    throw new Error(`Must be instance of class \`${cls.name}\`.`);
  }

  /**
   * Checks for type `string`, and optionally matching a particular regular
   * expression.
   *
   * @param {*} value Arbitrary value.
   * @param {?RegExp|string} [match = null] Optional regular expression that
   *  `value` must match.
   * @returns {string} `value` if it is of the indicated type.
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

  /**
   * Checks for type "class which is a (possibly improper) subclass of some
   * other class."
   *
   * @param {*} value Arbitrary value.
   * @param {function(new:*)} baseClass Base class to check against `value`.
   * @returns {function(new:*)} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type.
   */
  static subclassOf(value, baseClass) {
    if (AskIf.subclassOf(value, baseClass)) {
      return value;
    }

    throw new Error(`Must be of type "subclass of ${baseClass.name}."`);
  }
}
