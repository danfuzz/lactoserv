// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ComboText } from '#p/ComboText';
import { IntfText } from '#p/IntfText';
import { TypeText } from '#p/TypeText';


/**
 * Text which is to treated as having more indentation than its surrounding
 * context, if it turns out to be rendered over multiple lines.
 */
export class IndentedText extends IntfText {
  /**
   * The text, which _might_ end up indented.
   *
   * @type {TypeText}
   */
  #innerText;

  /**
   * Constructs an instance.
   *
   * @param {TypeText|Array<TypeText>} innerText The text, which _might_ end up
   *   indented. If passed as an array, this creates an instance of
   *   {@link ComboText} to serve as the actual value.
   */
  constructor(innerText) {
    super();

    this.#innerText = Array.isArray(innerText)
      ? new ComboText(innerText)
      : innerText;
  }

  /** @override */
  get length() {
    return this.#innerText.length;
  }

  /** @override */
  toString() {
    return this.#innerText.toString();
  }
}
