// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * A text string with style/color escape codes, which knows its "visible"
 * length. Its API is meant to be compatible with built-in `string`s, such that
 * much of the time client code need not determine if it has a regular `string`
 * or an instance of this class.
 */
export class StyledText {
  /**
   * The string, including style/color escapes.
   *
   * @type {string}
   */
  #value;

  /**
   * The visible length of the string.
   *
   * @type {number}
   */
  #visibleLength;

  /**
   * Constructs an instance.
   *
   * @param {string} value The string, including style/color escapes.
   * @param {number} visibleLength The visible length of the string.
   */
  constructor(value, visibleLength) {
    this.#value         = value;
    this.#visibleLength = visibleLength;
  }

  /**
   * @returns {number} The visible length of the string. This is done so that
   * code that calculates visible lengths can use `.length` without having to
   * differentiate between instances of this class and regular `string`s.
   */
  get length() {
    return this.#visibleLength;
  }

  /** @returns {string} The string, including style/color escapes. */
  get value() {
    return this.#value;
  }

  /**
   * Standard conversion method to get a primitive value out of an object. This
   * is used, notably, by `Array.join()`.
   *
   * @returns {string} The string, including style/color escapes.
   */
  [Symbol.toPrimitive]() {
    return this.#value;
  }
}
