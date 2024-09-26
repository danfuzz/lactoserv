// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseCodec, Sexp } from '@this/codec';
import { MustBe } from '@this/typey';


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
      this.#numeratorUnit = MustBe.string(numeratorUnit, /./);
    }

    if (denominatorUnit !== null) {
      this.#denominatorUnit = MustBe.string(denominatorUnit, /./);
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
   * @returns {string} String in a form accepted by {@link #parseUnitSpec},
   * representing the units of this instance. More specifically, this always
   * produces a string of the form `numeratorUnit/denominatorUnit`, that is,
   * with a slash separating the numerator and denominator unit and with no
   * additional spaces or underscores. If either numerator or denominator is
   * absent, the corresponding side of the `/` is empty. In the case of a
   * unitless instance, this is simply `/`.
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
   * Implementation of `codec` custom-encode protocol.
   *
   * @returns {Sexp} Encoded form.
   */
  [BaseCodec.ENCODE]() {
    return new Sexp(this.constructor,
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
   * missing units or conversions).
   *
   * In order to convert, this instance must have a unit (numerator or
   * denominator) that corresponds to each of the given tables, and no other
   * units. The end result is, in effect, a unitless value having had all the
   * units canceled out. The idea here is that you can take an instance which is
   * meant to represent some kind of real-world measurement (such speed) with a
   * variety of units and end up with a value with implied-but-known units,
   * e.g., convert `km/sec` _and_ `mile/hr` _and_ `mm/min` all to just `m/sec`.
   *
   * Each table has numerator or denominator names (including possibly a mix) as
   * keys, and multiplication factors as values. A numerator key is a unit name
   * with a slash (`/`) suffix (e.g., `sec/`). A denominator key is a unit name
   * with a slash (`/`) prefix (e.g., '/sec').
   *
   * @param {...Map<string, number>} unitMaps One map for each set of required
   *   units.
   * @returns {?number} The converted value, or `null` if it could not be
   *   converted.
   */
  convertValue(...unitMaps) {
    const numerUnit = this.#numeratorUnit;
    const denomUnit = this.#denominatorUnit;
    const unitSet   = new Set();
    let   value     = this.#value;

    if (numerUnit !== null) {
      unitSet.add(`${numerUnit}/`);
    }

    if (denomUnit !== null) {
      unitSet.add(`/${denomUnit}`);
    }

    outer:
    for (const oneMap of unitMaps) {
      for (const u of unitSet) {
        const mult = oneMap.get(u);
        if (mult !== undefined) {
          value *= mult;
          unitSet.delete(u);
          continue outer;
        }
      }

      // Didn't find a match for this `unitMaps` argument.
      return null;
    }

    if (unitSet.size !== 0) {
      // Didn't find matches for all units in this instance.
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
   * Indicates whether the given other instance has the same units as this one.
   *
   * @param {UnitQuantity} other Instance to check.
   * @returns {boolean} `true` iff `other`'s units are the same as this one.
   */
  hasSameUnits(other) {
    MustBe.instanceOf(other, UnitQuantity);
    return (this.#numeratorUnit === other.#numeratorUnit)
      && (this.#denominatorUnit === other.#denominatorUnit);
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
   * Checks to see if this instance's value is within a given range.
   *
   * @param {object} options Options which define the range.
   * @param {?number} [options.maxExclusive] Exclusive maximum value. That is,
   *   require `value < maxExclusive`.
   * @param {?number} [options.maxInclusive] Inclusive maximum value. That is,
   *   require `value <= maxInclusive`.
   * @param {?number} [options.minExclusive] Exclusive minimum value. That is,
   *   require `value > minExclusive`.
   * @param {?number} [options.minInclusive] Inclusive minimum value. That is,
   *   require `value >= minInclusive`.
   * @returns {boolean} `true` if the range restrictions are satisfied, or
   *   `false` if not.
   */
  isInRange(options) {
    const {
      maxExclusive = null,
      maxInclusive = null,
      minExclusive = null,
      minInclusive = null
    } = options;

    const value = this.#value;

    if (!(   ((minExclusive === null) || (value >  minExclusive))
          && ((minInclusive === null) || (value >= minInclusive))
          && ((maxExclusive === null) || (value <  maxExclusive))
          && ((maxInclusive === null) || (value <= maxInclusive)))) {
      return false;
    }

    return true;
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
   * Gets a string form of this instance.
   *
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.spaces] Use spaces to separate the number from
   *   the units? If `false` an underscore is used. Defaults to `true`.
   * @returns {string} The string form.
   */
  toString(options = null) {
    const { spaces = true } = options ?? {};

    const spc   = spaces ? ' ' : '_';
    const numer = this.#numeratorUnit;
    const denom = this.#denominatorUnit;
    const value = this.#value;

    if (numer === null) {
      return (denom === null)
        ? `${value}`
        : `${value}${spc}/${denom}`;
    } else {
      return (denom === null)
        ? `${value}${spc}${numer}`
        : `${value}${spc}${numer}/${denom}`;
    }
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
   * value indicates the preferred class for the result of calls to
   * {@link #inverse}.
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
   * as defined by {@link #parseUnitSpec}.
   *
   * This method _also_ optionally accepts `value` as an instance of this class,
   * (to make use of the method when parsing configurations a bit easier).
   *
   * @param {string|UnitQuantity} valueToParse The value to parse, or the value
   *   itself.
   * @param {object} [options] Options to control the allowed range of values.
   * @param {?boolean} [options.allowInstance] Accept instances of this class?
   *   Defaults to `true`.
   * @param {?object} [options.convert] Optional unit conversion information, to
   *   apply to the initial parsed result.
   * @param {function(new:*, number)} [options.convert.resultClass] Class to
   *   construct with the final converted value. If specified, a non-`null`
   *   return value from this class will be the result of a `new` call on this
   *   class, passing it the converted value (a number) as its sole argument. It
   *   is not valid to specify both this and `resultUnit`.
   * @param {?string} [options.convert.resultUnit] Optional final result unit,
   *   in the same format as taken by {@link #parseUnitSpec}. If specified, a
   *   non-`null` return value from this method will be an instance of this
   *   class (`UnitQuantity` per se), with the indicated units. If not specified
   *   (and `resultClass` isn't either), the return value will be a unitless
   *   instance of this class. It is not valid to specify both this and
   *   `resultClass`.
   * @param {?Array<Map>} [options.convert.unitMaps] Optional unit maps to
   *   apply, using {@link #convertValue}. That method (or equivalent) will be
   *   called to produce the final numeric value. If not specified, then the
   *   original `valueToParse` must use the same units as `resultUnit` (which
   *   means unitless if `resultUnit` is not specified).
   * @param {?object} [options.range] Optional range restrictions, in the form
   *   of the argument required by {@link #isInRange}. If present, the result of
   *   a parse is `null` when the range is not satisfied. If this and `convert`
   *   are both present, the range check happens _after_ conversion.
   * @returns {?UnitQuantity} The parsed instance, or `null` if the value could
   *   not be parsed.
   */
  static parse(valueToParse, options = null) {
    const {
      allowInstance = true,
      convert       = null,
      range         = null
    } = options ?? {};

    let result;

    if (valueToParse instanceof UnitQuantity) {
      if (allowInstance) {
        result = valueToParse;
      } else {
        return null;
      }
    } else if (typeof valueToParse === 'string') {
      result = this.#parseString(valueToParse);
      if (result === null) {
        return null;
      }
    } else {
      throw new Error(`Cannot parse value: ${valueToParse}`);
    }

    if (convert) {
      const { resultClass = null, resultUnit = null, unitMaps = null } = convert;
      const unitSpec   = UnitQuantity.parseUnitSpec(resultUnit ?? '/');

      if ((resultClass !== null) && (resultUnit !== null)) {
        throw new Error('Cannot use both `resultClass` and `resultUnit`.');
      } else if (unitSpec === null) {
        throw new Error(`Invalid \`resultUnit\`: ${resultUnit}`);
      }

      if (unitMaps) {
        const finalValue = result.convertValue(...(unitMaps ?? []));

        if (finalValue === null) {
          return null;
        }

        result = resultClass
          ? new resultClass(finalValue)
          : new UnitQuantity(finalValue, ...unitSpec);
      } else if (resultClass) {
        result = new resultClass(result.value);
      } else {
        const unitCheck = new UnitQuantity(0, ...unitSpec);
        if (!unitCheck.hasSameUnits(result)) {
          return null;
        }
      }

      if (valueToParse instanceof (resultClass ?? UnitQuantity)) {
        // We started with an instance of the right class as the value to parse.
        // If it turns out that conversion was effectively a no-op, then restore
        // the result to the original argument.
        if (result.hasSameUnits(valueToParse)) {
          result = valueToParse;
        }
      }
    }

    if (range) {
      if (!result.isInRange(range)) {
        return null;
      }
    }

    return result;
  }

  /**
   * Parses a unit specification string. Generally, the syntax accepted is a
   * numerator unit name separated from a denominator unit name by a slash (`/`)
   * or the word `per`. Details:
   *
   * * There may be any number of spaces surrounding the main unit string.
   * * Unit names must each be a series of one or more Unicode letters (case
   *   sensitive), of no more than ten characters.
   * * The unit names may optionally be separated from a slash by a single space
   *   or underscore (`_`).
   * * If `per` is used instead of a slash, it _must_ be separated from unit
   *   names with either a space or underscore.
   * * The unit name `per` is not allowed (because it would be too confusing).
   * * It is valid to omit either unit name, or both. For example, the strings
   *   `/` and `per` represent the "unitless unit."
   * * It is valid to omit the slash or `per` if the denominator is omitted.
   * * The empty string (or a string with just spaces) is also allowed, and
   *   represents the "unitless unit."
   * * The numerator and denominator are allowed to be the same string (e.g.
   *   `mile per mile`), which also represents the "unitless unit."
   *
   * @param {string} unitSpec Unit specification to parse.
   * @returns {?Array<string>} Array of arguments suitable to pass to the
   *   constructor of this class as unit arguments, or `null` if `unitSpec`
   *   could not be parsed.
   */
  static parseUnitSpec(unitSpec) {
    MustBe.string(unitSpec);

    // Trim away spaces on either end of `unitSpec`, and validates the character
    // set used within the main spec string.
    unitSpec = unitSpec.match(/^ *(?<us>(?!=[ _])[ _\/\p{Letter}]*(?<![ _])) *$/v)?.groups.us ?? null;

    if (unitSpec === null) {
      return null;
    }

    // Used to match the denominator spec, in both denominator-only specs and
    // full-spec contexts.
    const denomMatch = (spec) => {
      const match = spec.match(/^(?:(?:\/|per(?=[ _]|$))[ _]?(?<denom>.*))?$/);
      return match
        ? match.groups.denom ?? ''
        : null;
    };

    let numer = '';
    let denom = denomMatch(unitSpec); // Matches if there is no numerator.

    if (denom === null) {
      // There is a numerator.

      // This regex `match()` shouldn't ever fail.
      const { n, denomSpec } = unitSpec.match(/^(?<n>[^ _/]*)[ _]?(?<denomSpec>.*)$/).groups;

      numer = n;
      denom = denomMatch(denomSpec);

      if (denom === null) {
        return null;
      }
    }

    if (!(/^\p{Letter}{0,10}$/v.test(numer) && /^\p{Letter}{0,10}$/v.test(denom))) {
      // A slash or an underscore was present in one of these, or one was too
      // long.
      return null;
    } else if ((numer === 'per') || (denom === 'per')) {
      // Disallowed to avoid confusion. (See doc comment.)
      return null;
    }

    const finalNumer = ((numer === '') || (numer === denom)) ? null : numer;
    const finalDenom = ((denom === '') || (numer === denom)) ? null : denom;

    return [finalNumer, finalDenom];
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

    // Trim away spaces on either end of `value`.
    value = value.match(/^ *(?<v>.*[^ ]) *$/)?.groups.v ?? null;

    if (!value) {
      return null;
    }

    // This matches both the number and unit spec, but in both cases with loose
    // matching which gets tightened up below.
    const overallMatch = value.match(/^(?<num>[-+._0-9eE]+(?<!_))[ _]?(?! )(?<unit>.{0,100})$/);

    if (!overallMatch) {
      return null;
    }

    const { num: numStr, unit } = overallMatch.groups;

    // Disallow underscores in `num` not surrounded by digits.
    if (/^_|[^0-9]_|_[^0-9]/.test(numStr)) {
      return null;
    }

    const num = Number(numStr.replaceAll(/_/g, ''));

    if (isNaN(num)) {
      return null;
    }

    const unitSpec = this.parseUnitSpec(unit);

    if (!unitSpec) {
      return null;
    }

    return new UnitQuantity(num, ...unitSpec);
  }
}
