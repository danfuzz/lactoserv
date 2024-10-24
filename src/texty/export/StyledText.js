// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfText } from '#x/IntfText';


/**
 * A text string with style/color escape codes, and with no internal newlines,
 * which knows its "visible" length. Its API is meant to be compatible with
 * built-in `string`s, such that much of the time client code need not determine
 * if it has a regular `string` or an instance of this class.
 */
export class StyledText extends IntfText {
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
   * Constructs an instance. This takes _either_ an unstyled string and a
   * styling function, _or_ a styled string and a precomputed visible length.
   *
   * @param {string} value The string, either with or without style/color
   *   escapes.
   * @param {number|Function} visibleLengthOrStyler The visible length of the
   *   string _or_ a styling function to apply to `value`.
   */
  constructor(value, visibleLengthOrStyler) {
    super();

    if (typeof visibleLengthOrStyler === 'number') {
      this.#value         = value;
      this.#visibleLength = visibleLengthOrStyler;
    } else {
      this.#value         = visibleLengthOrStyler(value);
      this.#visibleLength = value.length;
    }
  }

  /** @override */
  get length() {
    return this.#visibleLength;
  }

  /** @override */
  render(options_unused) {
    // There are no internal breaks in instances of this class, so there's
    // nothing to do except just return the underlying string.
    return this.toString();
  }

  /** @override */
  toString() {
    return this.#value;
  }
}
