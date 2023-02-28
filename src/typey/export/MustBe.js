// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

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
   * @param {?object} [options = null] Options for restrictions. See {@link
   * AskIf#number} for details.
   * @returns {number} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type or does not meet the
   *   optional restrictions.
   */
  static number(value, options = null) {
    if (AskIf.number(value, options)) {
      return value;
    }

    if (options) {
      const optStr = util.inspect(options);
      throw new Error(`Must be of type \`number\`, with restrictions: ${optStr}`);
    } else {
      throw new Error('Must be of type `number`.');
    }
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
   * Checks for type `string`, optionally matching a particular regular
   * expression.
   *
   * @param {*} value Arbitrary value.
   * @param {?RegExp|string} [match = null] Optional regular expression that
   *  `value` must match.
   * @returns {string} `value` if it is of the indicated type.
   * @throws {Error} Thrown if `value` is of any other type or doesn't match.
   */
  static string(value, match = null) {
    if (AskIf.string(value, match)) {
      return value;
    }

    if (match) {
      throw new Error(`Must be of type \`string\` and match pattern: ${match}`);
    } else {
      throw new Error('Must be of type `string`.');
    }
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
