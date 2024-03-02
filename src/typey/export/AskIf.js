// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '#x/MustBe';


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
   * Checks for type `array`, where each element must be of a particular type,
   * specified as a predicate.
   *
   * @param {*} value Arbitrary value.
   * @param {function(*): boolean} predicate Predicate to match.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static arrayOf(value, predicate) {
    if (!Array.isArray(value)) {
      return false;
    }

    for (const v of value) {
      if (!predicate(v)) {
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
   * Checks for type `bigint`, which may optionally be restricted further.
   *
   * @param {*} value Arbitrary value.
   * @param {?object} [options] Options for restrictions.
   * @param {?bigint} [options.maxExclusive] Exclusive maximum value.
   *   That is, require `value < maxExclusive`.
   * @param {?bigint} [options.maxInclusive] Inclusive maximum value.
   *   That is, require `value <= maxInclusive`.
   * @param {?bigint} [options.minExclusive] Exclusive minimum value.
   *   That is, require `value > minExclusive`.
   * @param {?bigint} [options.minInclusive] Inclusive minimum value.
   *   That is, require `value >= minInclusive`.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static bigint(value, options = null) {
    if (typeof value !== 'bigint') {
      return false;
    }

    const {
      maxExclusive = null,
      maxInclusive = null,
      minExclusive = null,
      minInclusive = null,
    } = options ?? {};

    if (!(   ((minExclusive === null) || (value > minExclusive))
          && ((minInclusive === null) || (value >= minInclusive))
          && ((maxExclusive === null) || (value < maxExclusive))
          && ((maxInclusive === null) || (value <= maxInclusive)))) {
      return false;
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
   * **Further note:** There is a TC39 proposal that would address this
   * problem: <https://github.com/caitp/TC39-Proposals/blob/HEAD/tc39-reflect-isconstructor-iscallable.md>
   * Unfortunately it is not (as of this writing) close to being accepted.
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

    // Extra twist: If `value` is a revoked proxy, then we'll make it here, so
    // we need to detect that. See longer comment about this in
    // `constructorFunction()` for more details.
    try {
      Symbol() in value; // eslint-disable-line symbol-description
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks for type "constructor function," that is whether the given value is
   * a function which will allow calling when preceded by `new`. These are of
   * course also often just called "classes."
   *
   * **Note:** This implementation is imperfect and inefficient. There is a TC39
   * proposal that would address this problem:
   * <https://github.com/caitp/TC39-Proposals/blob/HEAD/tc39-reflect-isconstructor-iscallable.md>
   * Unfortunately it is not (as of this writing) close to being accepted.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static constructorFunction(value) {
    if ((typeof value) !== 'function') {
      return false;
    }

    // It's a function. Now we need to know if it's usable as a constructor. The
    // following code is based on the technique described at
    // <https://esdiscuss.org/topic/add-reflect-isconstructor-and-reflect-iscallable#content-2>
    // and <https://stackoverflow.com/questions/39334278/>. The core idea here
    // is that `Proxy`'s specified behavior can reveal the already-defined
    // spec-internal `[[IsConstructor]]` operation without actually ever calling
    // the function in question.

    try {
      const p = new Proxy(value, {
        construct() { return p; }
      });
      new p();

      // Extra twist: If `value` is a revoked proxy, then we'll make it here, so
      // we need to detect that, which we do by taking advantage of the facts
      // (a) that property access on a revoked proxy will throw an error, and
      // (b) that a fresh uninterned Symbol won't be found on any real object
      // and is (alas merely) unlikely to cause any behavior on an active
      // proxy. See <https://gist.github.com/metastable-void/a53f10539eff6c80cc36b62b2e0bfc4d>
      // Note that the promising-looking suggestion at
      // <https://stackoverflow.com/questions/39335909> does not seem to work in
      // practice.
      Symbol() in value; // eslint-disable-line symbol-description

      return true;
    } catch {
      return false;
    }
  }

  // Note: No method `frozen()`, because of the standard `Object.isFrozen(v)`.

  // Note: No method `function()`, because of the standard `typeof v ===
  // 'function'`.

  // Note: No method `instanceOf()`, because of the standard `v instanceof
  // Class`.

  // Note: No method `null()`, because of the standard `v === null`.

  /**
   * Checks for type `number`, which may optionally be restricted further.
   *
   * @param {*} value Arbitrary value.
   * @param {?object} [options] Options for restrictions.
   * @param {boolean} [options.finite] Must `value` be finite?
   * @param {?number} [options.maxExclusive] Exclusive maximum value.
   *   That is, require `value < maxExclusive`.
   * @param {?number} [options.maxInclusive] Inclusive maximum value.
   *   That is, require `value <= maxInclusive`.
   * @param {?number} [options.minExclusive] Exclusive minimum value.
   *   That is, require `value > minExclusive`.
   * @param {?number} [options.minInclusive] Inclusive minimum value.
   *   That is, require `value >= minInclusive`.
   * @param {boolean} [options.safeInteger] Must `value` be a safe
   *   integer (exactly representable integer as a regular JavaScript number).
   *   Implies `options.finite: true`.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static number(value, options = null) {
    if (typeof value !== 'number') {
      return false;
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
        return false;
      }
    } else if (finite) {
      if (!Number.isFinite(value)) {
        return false;
      }
    }

    if (!(   ((minExclusive === null) || (value > minExclusive))
          && ((minInclusive === null) || (value >= minInclusive))
          && ((maxExclusive === null) || (value < maxExclusive))
          && ((maxInclusive === null) || (value <= maxInclusive)))) {
      return false;
    }

    return true;
  }

  /**
   * Checks for type `object`, which must furthermore not be `null`.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static object(value) {
    return (value !== null) && (typeof value === 'object');
  }

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

  /**
   * Checks for type `string`, optionally matching a particular regular
   * expression.
   *
   * @param {*} value Arbitrary value.
   * @param {?RegExp|string} [match] Optional regular expression that
   *  `value` must match.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static string(value, match = null) {
    if (typeof value !== 'string') {
      return false;
    }

    if (match) {
      if (typeof match === 'string') {
        match = new RegExp(match);
      }
      if (!match.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks for type "class which is a (possibly improper) subclass of some
   * other class."
   *
   * @param {*} value Arbitrary value.
   * @param {function(new:*)} baseClass Base class to check against `value`.
   * @returns {boolean} `true` iff `value` is of the indicated type.
   */
  static subclassOf(value, baseClass) {
    // Type requirement for `baseClass`. We're not "asking" about this.
    MustBe.constructorFunction(baseClass);

    if (!AskIf.constructorFunction(value)) {
      return false;
    } else if (value === baseClass) {
      return true;
    } else {
      return (value instanceof baseClass.constructor)
        && (value.prototype instanceof baseClass);
    }
  }
}
