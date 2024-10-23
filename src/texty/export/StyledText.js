// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfText } from '#x/IntfText';


/**
 * A text string with style/color escape codes, which knows its "visible"
 * length. Its API is meant to be compatible with built-in `string`s, such that
 * much of the time client code need not determine if it has a regular `string`
 * or an instance of this class.
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
   * Constructs an instance.
   *
   * @param {string} value The string, including style/color escapes.
   * @param {number} visibleLength The visible length of the string.
   */
  constructor(value, visibleLength) {
    super();
    this.#value         = value;
    this.#visibleLength = visibleLength;
  }

  /** @override */
  get length() {
    return this.#visibleLength;
  }

  /** @override */
  toString() {
    return this.#value;
  }
}
