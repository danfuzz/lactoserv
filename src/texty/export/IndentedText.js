// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ComboText } from '#x/ComboText';
import { IntfText } from '#x/IntfText';
import { TypeText } from '#x/TypeText';


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
   * @param {...TypeText} innerText The text, which _might_ end up indented. If
   *   more than one argument is passed, this uses an instance of
   *   {@link ComboText} to serve as the actual inner text value.
   */
  constructor(...innerText) {
    super();

    this.#innerText = (innerText.length !== 1)
      ? new ComboText(...innerText)
      : innerText[0];
  }

  /** @override */
  get length() {
    return this.#innerText.length;
  }

  /** @override */
  render(options) {
    const singleLineResult = IntfText.renderSingleLineIfPossible(this, options);
    if (singleLineResult) {
      return singleLineResult;
    }

    // Note: Setting `*Column` to `maxWidth` (used twice below) ensures that
    // the rendering is all on its own lines (newlines before and/or after when
    // necessary).

    const { atColumn, indentLevel, maxWidth, ...restOpts } = options;
    const { value } = IntfText.render(this.#innerText, {
      atColumn:    (atColumn === -1) ? -1 : maxWidth,
      indentLevel: indentLevel + 1,
      maxWidth,
      ...restOpts
    });

    return { endColumn: maxWidth, value };
  }

  /** @override */
  toString() {
    return this.#innerText.toString();
  }
}
