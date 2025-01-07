// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


import { Methods } from '@this/typey';

import { TypeText } from '#x/TypeText';


/**
 * Base class for the various concrete "rendered text" classes. These classes
 * are all set up so that their clients can often be oblivious to the
 * distinction between both each other as well as `string` primitives.
 */
export class BaseText {
  /**
   * @abstract
   * @returns {number} The visible length of the string. This is done so that
   *   code that calculates visible lengths can use `.length` without having to
   *   differentiate between instances of this class and regular `string`s.
   */
  get length() {
    throw Methods.abstract();
  }

  /**
   * Renders this instance into a string, possibly over multiple lines,
   * returning both the rendered form and the column number of the cursor
   * resulting from the render.
   *
   * @param {object} [options] Rendering options.
   * @param {?boolean} [options.allowBreak] Allow a newline to be inserted
   *   before rendering? Defaults to `true`.
   * @param {?number} [options.atColumn] The zero-based column of the "cursor"
   *   with respect to the rendering, including any indentation. The special
   *   value of `-1` indicates that the column is zero _and_ no indentation has
   *   yet been emitted for the current line. This option is taken into
   *   consideration when figuring out whether an instance can be rendered in
   *   single-line form. Defaults to `-1`.
   * @param {number} [options.indentLevel] The indent level to render this at.
   *   This indicates the number of indentations to insert after each newline.
   *   Defaults to `0`.
   * @param {number} [options.indentWidth] Number of spaces per indentation
   *   level. Defaults to `2`.
   * @param {?number} [options.maxWidth] The desired maximum rendered width in
   *   columns, or `null` not to have a limit. This target _might_ not be
   *   achievable (e.g., because of a part which is too long and has no internal
   *   potential line breaks). Defaults to `null`.
   * @returns {{ endColumn: number, value: string }} The updated cursor position
   *   and the rendered form.
   */
  render(options = {}) {
    const thisLength = this.length;
    const maxWidth   = options.maxWidth ?? Number.POSITIVE_INFINITY;
    const {
      allowBreak  = true,
      atColumn    = -1,
      indentLevel = 0,
      indentWidth = 2
    } = options;
    options = { allowBreak, atColumn, indentLevel, indentWidth, maxWidth };

    if (atColumn !== -1) {
      const endColumn = atColumn + thisLength;
      if (endColumn <= maxWidth) {
        // A single-line render fits on the remaining portion of the current
        // line.
        return { endColumn, value: this.toString() };
      }
    }

    if (allowBreak) {
      const fullLineRequiredWidth = (indentLevel * indentWidth) + thisLength;
      if (fullLineRequiredWidth <= maxWidth) {
        // A single-line render fits on a line by itself.
        const maybeNl = (atColumn === -1) ? '' : '\n';
        const indent  = BaseText.indentString(options);
        return {
          endColumn: fullLineRequiredWidth,
          value:     `${maybeNl}${indent}${this.toString()}`
        };
      }
    }

    // Needs to be rendered over multiple lines (if possible).
    return this._impl_renderMultiline(options);
  }

  /**
   * Gets the simple string value of this instance, including any style/color
   * escapes, for use in rendering as a single line.
   *
   * @abstract
   * @returns {string} The simple string value of this instance.
   */
  toString() {
    throw Methods.abstract();
  }

  /**
   * Renders this instance over multiple lines, if possible. Subclasses which
   * are capable of doing multi-line renders are expected to override this
   * method. The base class implementation just does a single-line render, while
   * ensuring that it occurs on its own line when allowed.
   *
   * @param {object} options Rendering options, as with {@link #render}.
   * @returns {{ endColumn: number, value: string }} Result to return from
   *   {@link #render}.
   */
  _impl_renderMultiline(options) {
    const { allowBreak, atColumn, indentLevel, indentWidth } = options;

    if ((atColumn !== -1) && !allowBreak) {
      return {
        endColumn: atColumn + this.length,
        value:     this.toString()
      };
    }

    const maybeNl   = (atColumn === -1) ? '' : '\n';
    const endColumn = (indentLevel * indentWidth) + this.length;
    const indent    = BaseText.indentString(options);

    return { endColumn, value: `${maybeNl}${indent}${this.toString()}` };
  }


  //
  // Static members
  //

  /**
   * Cache of precomputed indent strings, as a sparse array.
   *
   * @type {Array<string>}
   */
  static #INDENT_CACHE = [];

  /**
   * Gets an indentation string based on the given {@link #render} options.
   *
   * @param {object} options The render options.
   * @param {object} options.indentLevel Same as with {@link #render}.
   * @param {object} options.indentWidth Same as with {@link #render}.
   * @returns {string} The indentation string.
   */
  static indentString({ indentLevel, indentWidth }) {
    const len     = indentLevel * indentWidth;
    const already = BaseText.#INDENT_CACHE[len];

    if (already) {
      return already;
    } else {
      const indent = ' '.repeat(len);
      BaseText.#INDENT_CACHE[len] = indent;
      return indent;
    }
  }

  /**
   * Calculates the total visible length of a list of {@link TypeText}s.
   *
   * @param {...TypeText} texts The texts.
   * @returns {number} The total visible length.
   */
  static visibleLengthOf(...texts) {
    let len = 0;
    for (const t of texts) {
      len += t.length;
    }

    return len;
  }
}
