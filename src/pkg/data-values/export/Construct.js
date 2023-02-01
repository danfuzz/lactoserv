// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

/**
 * Data value that represents the construction of a behavior-bearing object.
 *
 * Instances of this class are always frozen.
 */
export class Construct {
  /** @type {*} Value representing the type (or class) to be constructed. */
  #type;

  /** @type {*[]} Arguments to be used in constructing the value. */
  #args;

  /**
   * Constructs an instance.
   *
   * @param {*} type Value representing the type (or class) to be constructed.
   * @param {...*} args Arguments to be used in constructing the value.
   */
  constructor(type, ...args) {
    this.#type = type;
    this.#args = Object.freeze(args);

    Object.freeze(this);
  }

  /** @returns {*} Value representing the type (or class) to be constructed. */
  get type() {
    return this.#type;
  }

  /**
   * @returns {*[]} Arguments to be used in constructing the value. This is
   * always a frozen array.
   */
  get args() {
    return this.#args;
  }

  /**
   * Gets the "inner value" of this instance, which is suitable for conversion,
   * to produce a converted instance of this class.
   *
   * @returns {*} Convertible inner value.
   */
  toConvertibleValue() {
    return [this.#type, ...this.#args];
  }

  /**
   * Gets a replacement value for this instance, which is suitable for JSON
   * serialization. In this case, this method is meant to be a convenience when
   * doing "manual" mixing of encoding (per this class) and JSON serialization.
   *
   * **Note:** This method is named as such (as opposed to the more
   * standard-for-this-project `toJSON`), because the standard method
   * `JSON.stringify()` looks for methods of this name to provide custom JSON
   * serialization.
   *
   * @returns {object} The JSON-serializable form.
   */
  toJSON() {
    return { '@construct': this.toConvertibleValue() };
  }

  /**
   * Gets an instance just like this one, but with the given replacement
   * inner value.
   *
   * @param {*} innerValue The new inner value.
   * @returns {*} A replacement instance for this one, representing its
   *   conversion.
   */
  withConvertedValue(innerValue) {
    return new Construct(...innerValue);
  }
}
