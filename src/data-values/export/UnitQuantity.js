// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Struct } from '#x/Struct';


/**
 * Value for the exposed {@link UnitQuantity#INVERSE}.
 *
 * @type {symbol}
 */
const INVERSE_SYMBOL = Symbol('UnitQuantity.INVERSE');

/**
 * Representation of a numeric quantity with an associated named unit. The unit
 * is allowed to be either a numerator or a denominator or a combination of the
 * two. This class does not inherently associate unit names as having any
 * particular relationship to each other (or to the world in general), however
 * subclasses can choose to impose an interpretation.
 *
 * This class restricts values to only ever be finite numbers.
 *
 * This class includes parsing methods, which can parse strings into instances
 * of this class.
 *
 * Instances of this class are always frozen.
 */
export class UnitQuantity {
  /**
   * The numeric value being represented.
   *
   * @type {number}
   */
  #value;

  /**
   * The numerator unit, if any.
   *
   * @type {?string}
   */
  #numeratorUnit = null;

  /**
   * The denominator unit, if any.
   *
   * @type {?string}
   */
  #denominatorUnit = null;

  /**
   * Constructs an instance.
   *
   * @param {number} value The numeric value being represented.
   * @param {?string} numeratorUnit The numerator unit, or `null` if none.
   * @param {?string} denominatorUnit The denominator unit, or `null` if none.
   */
  constructor(value, numeratorUnit, denominatorUnit) {
    this.#value = MustBe.number(value, { finite: true });

    if (numeratorUnit !== null) {
      this.#numeratorUnit = MustBe.string(numeratorUnit);
    }

    if (denominatorUnit !== null) {
      this.#denominatorUnit = MustBe.string(denominatorUnit);
    }

    Object.freeze(this);
  }

  /**
   * @returns {function(new:UnitQuantity)} Class to use when constructing a new
   * instance via {@link #inverse}. Defaults to this class. Subclasses can
   * override this as necessary.
   */
  get [INVERSE_SYMBOL]() {
    return UnitQuantity;
  }

  /** @returns {?string} The denominator unit, or `null` if none. */
  get denominatorUnit() {
    return this.#denominatorUnit;
  }

  /** @returns {?string} The numerator unit, or `null` if none. */
  get numeratorUnit() {
    return this.#numeratorUnit;
  }

  /**
   * @returns {string} String in the form `numeratorUnit/denominatorUnit`,
   * representing both units. If either (or both) is absent, the corresponding
   * side of the `/` is empty. For a unitless instance, this is simply `/`.
   */
  get unitString() {
    const numer = this.#numeratorUnit ?? '';
    const denom = this.#denominatorUnit ?? '';

    return `${numer}/${denom}`;
  }

  /** @returns {number} The numeric value being represented. */
  get value() {
    return this.#value;
  }

  /**
   * Implementation of `data-values` custom-encode protocol.
   *
   * @returns {Struct} Encoded form.
   */
  [BaseConverter.ENCODE]() {
    return new Struct(this.constructor, null,
      this.#value, this.#numeratorUnit, this.#denominatorUnit);
  }

  /**
   * Adds the value of this instance to another, returning a new instance of the
   * same (possibly sub-) class as this. The other instance must have the same
   * units as this one.
   *
   * @param {UnitQuantity} other Other instance to add.
   * @returns {UnitQuantity} Summed result.
   */
  add(other) {
    this.#checkCompatibility(other);

    return new this.constructor(
      this.#value + other.#value,
      this.#numeratorUnit,
      this.#denominatorUnit);
  }

  /**
   * Compares the value of this instance to another, returning the usual values
   * `-1`, `0`, or `1` depending on the result of comparison. The other instance
   * must have the same units as this one.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {number} Usual comparison result.
   */
  compare(other) {
    this.#checkCompatibility(other);

    const thisValue  = this.#value;
    const otherValue = other.#value;

    if (thisValue === otherValue) {
      return 0;
    } else if (thisValue < otherValue) {
      return -1;
    } else {
      return 1;
    }
  }

  /**
   * Converts the value of this instance based on the given unit conversion
   * tables. Returns `null` if the conversion cannot be performed (because of
   * missing units or conversions). Each table has unit names as keys and
   * multiplication factors as values.
   *
   * **Note:** The denominator unit conversions are multiplication factors per
   * se, not divisors.
   *
   * @param {?Map<string, number>} numeratorUnits The allowed numerator units,
   *   or `null` if a numerator unit must not be present in the original
   *   quantity.
   * @param {?Map<string, number>} denominatorUnits The allowed denominator
   *   units, or `null` if a denominator unit must not be present in the
   *   original quantity.
   * @returns {?number} The converted value, or `null` if it could not be
   *   converted.
   */
  convertValue(numeratorUnits, denominatorUnits) {
    const numer = this.#numeratorUnit;
    const denom = this.#denominatorUnit;
    let   value = this.#value;

    if (numeratorUnits) {
      const mult = numeratorUnits.get(numer);
      if (mult === undefined) {
        return null;
      }
      value *= mult;
    } else if (numer) {
      return null;
    }

    if (denominatorUnits) {
      const mult = denominatorUnits.get(denom);
      if (mult === undefined) {
        return null;
      }
      value *= mult;
    } else if (denom) {
      return null;
    }

    return value;
  }

  /**
   * Shorthand for `.compare(other) == 0`.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {boolean} `true` iff `other == this`.
   */
  eq(other) {
    return this.compare(other) === 0;
  }

  /**
   * Shorthand for `.compare(other) >= 0`.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {boolean} `true` iff `other >= this`.
   */
  ge(other) {
    return this.compare(other) >= 0;
  }

  /**
   * Shorthand for `.compare(other) > 0`.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {boolean} `true` iff `other > this`.
   */
  gt(other) {
    return this.compare(other) > 0;
  }

  /**
   * Returns the inverse of this instance, that is, `1 / value`, with numerator
   * and denominator swapped.
   *
   * @returns {UnitQuantity} The inverse.
   */
  inverse() {
    const resultClass = this[INVERSE_SYMBOL];

    return new resultClass(1 / this.#value, this.#denominatorUnit, this.#numeratorUnit);
  }

  /**
   * Shorthand for `.compare(other) <= 0`.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {boolean} `true` iff `other <= this`.
   */
  le(other) {
    return this.compare(other) <= 0;
  }

  /**
   * Shorthand for `.compare(other) < 0`.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {boolean} `true` iff `other < this`.
   */
  lt(other) {
    return this.compare(other) < 0;
  }

  /**
   * Shorthand for `.compare(other) != 0`.
   *
   * @param {UnitQuantity} other Instance to compare to.
   * @returns {boolean} `true` iff `other != this`.
   */
  ne(other) {
    return this.compare(other) !== 0;
  }

  /**
   * Subtracts the value of another instance from this one, returning a new
   * instance of the same (possibly sub-) class as this. The other instance must
   * have the same units as this one.
   *
   * @param {UnitQuantity} other Other instance to add.
   * @returns {UnitQuantity} Difference result.
   */
  subtract(other) {
    this.#checkCompatibility(other);

    return new this.constructor(
      this.#value - other.#value,
      this.#numeratorUnit,
      this.#denominatorUnit);
  }

  /**
   * Throws an error if either the given value isn't an instance of this class
   * or if its units don't match this class.
   *
   * @param {*} value Value in question.
   * @throws {Error} Thrown if `value` isn't "compatible" with this instance.
   */
  #checkCompatibility(value) {
    MustBe.instanceOf(value, UnitQuantity);

    if (   (value.#numeratorUnit   !== this.#numeratorUnit)
        || (value.#denominatorUnit !== this.#denominatorUnit)) {
      throw new Error('Mismatched units.');
    }
  }

  //
  // Static members
  //

  /**
   * @returns {symbol} Symbol used for a getter on subclass instances, whose
   * value indicates the preferred class for the result of calls to {@link
   * #inverse}.
   */
  static get INVERSE() {
    return INVERSE_SYMBOL;
  }

  /**
   * Parses a string representing a unit quantity, returning an instance of this
   * class. The numeric value may have arbitrary spaces around it, and either a
   * space or an underscore (or nothing) is accepted between the number and unit
   * name. The number is allowed to be any regular floating point value
   * (including exponents), with underscores allowed in the middle of it (for
   * ease of reading, as with normal JavaScript constants). The unit names are
   * restricted to alphabetic characters (case sensitive) up to 20 characters in
   * length, and can either be a simple unit name taken to be a numerator, a
   * compound numerator-denominator in the form `num/denom` or `num per denom`
   * (literal `per`), or a denominator-only in the form `/denom` or `per denom`.
   * Slashes are allowed to have spaces or underscores around them, and `per`
   * can be separated with underscores instead of spaces.
   *
   * This method _also_ optionally accepts `value` as an instance of this class,
   * (to make use of the method when parsing configurations a bit easier).
   *
   * **Notes:**
   * * If the numerator and denominator units are identical, the result is a
   *   unitless instance.
   * * The unit name `per` is not allowed, as it is reserved as the
   *   word-equivalent of `/`.
   * * The range restriction options are only useful if the caller ends up
   *   requiring particular units.
   *
   * @param {string|UnitQuantity} value The value to parse, or the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @param {?boolean} [options.allowInstance] Accept instances of this class?
   *   Defaults to `true`.
   * @param {?number} [options.maxExclusive] Exclusive maximum value. That is,
   *   require `value < maxExclusive`.
   * @param {?number} [options.maxInclusive] Inclusive maximum value. That is,
   *   require `value <= maxInclusive`.
   * @param {?number} [options.minExclusive] Exclusive minimum value. That is,
   *   require `value > minExclusive`.
   * @param {?number} [options.minInclusive] Inclusive minimum value. That is,
   *   require `value >= minInclusive`.
   * @param {?boolean} [options.requireUnit] Require a unit of some sort?
   *   Defaults to `true`.
   * @returns {?UnitQuantity} The parsed duration, or `null` if the value could
   *   not be parsed.
   */
  static parse(value, options = null) {
    let result = null;

    if (value instanceof UnitQuantity) {
      if (options?.allowInstance ?? true) {
        result = value;
      }
    } else {
      result = this.#parseString(value);
    }

    if (result === null) {
      return null;
    }

    const {
      maxExclusive = null,
      maxInclusive = null,
      minExclusive = null,
      minInclusive = null,
      requireUnit  = true
    } = options ?? {};

    if (requireUnit && !(result.numeratorUnit || result.denominatorUnit)) {
      return null;
    }

    const resValue = result.value;

    if (!(   ((minExclusive === null) || (resValue >  minExclusive))
          && ((minInclusive === null) || (resValue >= minInclusive))
          && ((maxExclusive === null) || (resValue <  maxExclusive))
          && ((maxInclusive === null) || (resValue <= maxInclusive)))) {
      return null;
    }

    return result;
  }

  /**
   * Helper for {@link #parse}, which does the actual string parsing work.
   *
   * @param {string} value Value to parse.
   * @returns {?UnitQuantity} Parsed instance, or `null` if it couldn't be
   *   parsed.
   */
  static #parseString(value) {
    MustBe.string(value);

    // This matches both the number and possibly-combo unit, but in both cases
    // with loose matching which gets tightened up below.
    const overallMatch =
      value.match(/^ *(?<num>[\-+._0-9eE]+(?<!_))[ _]?(?<unit>(?![ _])[ _\/\p{Letter}]{0,50}(?<![ _])) *$/v);

    if (!overallMatch) {
      return null;
    }

    const { num: numStr, unit } = overallMatch.groups;

    // Disallow underscores not surrounded by digits.
    if (/^_|[^0-9]_|_[^0-9]/.test(numStr)) {
      return null;
    }

    const num = Number(numStr.replaceAll(/_/g, ''));

    if (isNaN(num)) {
      return null;
    }

    const comboMatch = unit.match(/[ _]?(?:\/|(?<=[ _]|^)per(?=[ _]))[ _]?(?<denom>.+)$/v);

    const [numer, denom] = comboMatch
      ? [unit.slice(0, comboMatch.index), comboMatch.groups.denom]
      : [unit, ''];

    if (!(/^\p{Letter}*$/v.test(numer) && /^\p{Letter}*$/v.test(denom))) {
      return null;
    } else if ((numer === 'per') || (denom === 'per')) {
      // Disallowed to avoid confusion.
      return null;
    }

    const finalNumer = ((numer === '') || (numer === denom)) ? null : numer;
    const finalDenom = ((denom === '') || (numer === denom)) ? null : denom;

    return new UnitQuantity(num, finalNumer, finalDenom);
  }
}
