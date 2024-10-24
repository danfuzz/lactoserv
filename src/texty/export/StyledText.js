// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfText } from '#x/IntfText';
import { TypeText } from '#x/TypeText';


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
  toString() {
    return this.#value;
  }


  //
  // Static members
  //

  /**
   * Concatenates multiple instances of {@link TypeText} into a single instance
   * of this class. It uses `toString()` on instances, making the result be a
   * single-line rendering.
   *
   * @param {...TypeText|string} texts The texts to concatenate.
   * @returns {StyledText} The concatenated result.
   */
  static concat(...texts) {
    const len = IntfText.visibleLengthOf(...texts);
    return new StyledText(texts.join(''), len);
  }
}
