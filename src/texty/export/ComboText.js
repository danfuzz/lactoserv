// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseText } from '#x/BaseText';
import { StringText } from '#x/StringText';
import { TypeText } from '#x/TypeText';


/**
 * A list of text strings/objects (including instances of this class), which can
 * be treated as a single unit of text. Special static "text" values defined by
 * this class can be used in the constructor arguments to this class in order to
 * control formatting (indentation, line breaks, etc.).
 */
export class ComboText extends BaseText {
  /**
   * The text parts.
   *
   * @type {Array<TypeText>}
   */
  #parts;

  /**
   * The visible length of the string if rendered as a single line, or `null` if
   * not yet calculated.
   *
   * @type {?number}
   */
  #visibleLength = null;

  /**
   * The concatenated parts as a single line, or `null` if not yet calculated.
   *
   * @type {?string}
   */
  #singleLineValue = null;

  /**
   * Constructs an instance.
   *
   * @param {...TypeText} parts The text parts. Any parts which are plain
   *   strings get wrapped in instances of {@link StringText}.
   */
  constructor(...parts) {
    super();

    for (let at = 0; at < parts.length; at++) {
      if (typeof parts[at] === 'string') {
        parts[at] = new StringText(parts[at]);
      }
    }

    this.#parts = parts;
  }

  /** @override */
  get length() {
    if (this.#visibleLength === null) {
      let len = 0;
      for (const part of this.#parts) {
        len += part.length;
      }
      this.#visibleLength = len;
    }

    return this.#visibleLength;
  }

  /** @override */
  toString() {
    if (!this.#singleLineValue) {
      this.#singleLineValue = this.#parts.join('');
    }

    return this.#singleLineValue;
  }

  /** @override */
  _impl_renderMultiline(options) {
    const { maxWidth }             = options;
    let   { allowBreak, atColumn } = options;

    const result = [];

    if (allowBreak && (atColumn !== -1)) {
      atColumn = maxWidth; // Force it to start on a new line.
    }

    for (const part of this.#parts) {
      switch (part) {
        case ComboText.#CLEAR: {
          if (atColumn !== -1) {
            atColumn = maxWidth; // (See above.)
          }
          continue;
        }

        case ComboText.#INDENT: {
          options = { ...options, indentLevel: options.indentLevel + 1 };
          continue;
        }

        case ComboText.#NO_BREAK: {
          allowBreak = false;
          continue;
        }

        case ComboText.#OUTDENT: {
          options = { ...options, indentLevel: options.indentLevel - 1 };
          continue;
        }
      }

      const { endColumn, value } = part.render({ ...options, allowBreak, atColumn });
      allowBreak = true;
      atColumn   = endColumn;
      result.push(value);
    }

    return { endColumn: atColumn, value: result.join('') };
  }


  //
  // Static members
  //

  /**
   * Value for the corresponding getter.
   *
   * @type {TypeText}
   */
  static #CLEAR = new StringText('');

  /**
   * Value for the corresponding getter.
   *
   * @type {TypeText}
   */
  static #INDENT = new StringText('');

  /**
   * Value for the corresponding getter.
   *
   * @type {TypeText}
   */
  static #NO_BREAK = new StringText('');

  /**
   * Value for the corresponding getter.
   *
   * @type {TypeText}
   */
  static #OUTDENT = new StringText('');

  /**
   * @returns {TypeText} Special text instance indicating mid-render forcing of
   * a line break.
   */
  static get CLEAR() {
    return ComboText.#CLEAR;
  }

  /**
   * @returns {TypeText} Special text instance indicating mid-render indentation
   * increase.
   */
  static get INDENT() {
    return ComboText.#INDENT;
  }

  /**
   * @returns {TypeText} Special text instance indicating that no line break
   * should be added between the previous and next items to be rendered.
   */
  static get NO_BREAK() {
    return ComboText.#NO_BREAK;
  }

  /**
   * @returns {TypeText} Special text instance indicating mid-render indentation
   * increase.
   */
  static get OUTDENT() {
    return ComboText.#OUTDENT;
  }
}
