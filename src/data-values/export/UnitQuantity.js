// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Struct } from '#x/Struct';


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
  /** @type {number} The numeric value being represented. */
  #value;

  /** @type {?string} The numerator unit, if any. */
  #numeratorUnit = null;

  /** @type {?string} The denominator unit, if any. */
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

  /** @returns {?string} The denominator unit, or `null` if none. */
  get denominatorUnit() {
    return this.#denominatorUnit;
  }

  /** @returns {?string} The numerator unit, or `null` if none. */
  get numeratorUnit() {
    return this.#numeratorUnit;
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
    return new Struct(UnitQuantity,
      this.#value, this.#numeratorUnit, this.#denominatorUnit);
  }

  /**
   * Returns the inverse of this instance, that is, `1 / value`, with numerator
   * and denominator swapped.
   *
   * @returns {UnitQuantity} The inverse.
   */
  inverse() {
    return new UnitQuantity(1 / this.#value, this.#denominatorUnit, this.#numeratorUnit);
  }


  //
  // Static members
  //

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
   * **Note:** The unit name `per` is not allowed, as it is reserved as the
   * word-equivalent of `/`.
   *
   * @param {string|UnitQuantity} value The value to parse, or the value itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @param {?boolean} [options.allowInstance] Accept instances of this class.
   *   Defaults to `true`.
   * @param {?number} [options.maxExclusive] Exclusive maximum value.
   *   That is, require `value < maxExclusive`.
   * @param {?number} [options.maxInclusive] Inclusive maximum value.
   *   That is, require `value <= maxInclusive`.
   * @param {?number} [options.minExclusive] Exclusive minimum value.
   *   That is, require `value > minExclusive`.
   * @param {?number} [options.minInclusive] Inclusive minimum value.
   *   That is, require `value >= minInclusive`.
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

    return new UnitQuantity(
      num,
      (numer === '') ? null : numer,
      (denom === '') ? null : denom);
  }
}
