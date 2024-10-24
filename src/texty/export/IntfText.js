// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


import { Methods } from '@this/typey';

import { TypeText } from '#x/TypeText';

/**
 * Base class for the various concrete "rendered text" classes. These classes
 * are all set up so that their clients can often be oblivious to the
 * distinction between both each other as well as `string` primitives.
 *
 * @interface
 */
export class IntfText {
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
   * Renders this instance into a string, possibly over multiple lines.
   *
   * @abstract
   * @param {object} options Rendering options, as with the corresponding static
   *   method, except all are required.
   * @returns {string} The rendered form.
   */
  render(options) { // eslint-disable-line no-unused-vars
    throw Methods.abstract();
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


  //
  // Static members
  //

  /**
   * Gets an indentation string based on the given {@link #render} options. The
   * result includes an initial newline.
   *
   * @param {object} options The render options.
   * @param {object} options.indentLevel Same as with {@link #render}.
   * @param {object} options.indentWidth Same as with {@link #render}.
   * @returns {string} The indentation string.
   */
  static indentString({ indentLevel, indentWidth }) {
    return `\n${' '.repeat(indentLevel * indentWidth)}`;
  }

  /**
   * Renders an instance into a string, possibly over multiple lines; or returns
   * the given string directly. This method exists so as to provide reasonable
   * defaults for calling into the corresponding instance method, _and_ so
   * client code doesn't have to care if they happen to have been given a
   * regular `string` to render.
   *
   * @param {TypeText} text Text to render.
   * @param {object} [options] Rendering options.
   * @param {?number} [options.firstWidth] Amount of render width available on
   *   the first line. Defaults to `options.maxWidth`.
   * @param {number} [options.indentLevel] The indent level to render this at.
   *   This indicates the number of indentations to insert after each newline.
   *   Defaults to `0`.
   * @param {number} [options.indentWidth] Number of spaces per indentation
   *   level. Defaults to `2`.
   * @param {?number} [options.maxWidth] The desired maximum rendered width in
   *   columns, or `null` not to have a limit. This target _might_ not be
   *   achievable (e.g., because of a part which is too long and has no internal
   *   potential line breaks). Defaults to `null`.
   * @returns {string} The rendered form.
   */
  static render(text, { firstWidth, indentLevel = 0, indentWidth = 2, maxWidth = null } = {}) {
    if (typeof text === 'string') {
      return text;
    }

    firstWidth ??= maxWidth;
    return text.render({ firstWidth, indentLevel, indentWidth, maxWidth });
  }
}
