// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseText } from '#x/BaseText';


/**
 * An empty text string, which merely indicates where a line break is allowed,
 * when doing multi-line rendering.
 */
export class SepText extends BaseText {
  /**
   * Constructs an instance. This is effectively a private constructor. Use
   * {@link #THE_ONE}.
   */
  constructor() {
    super();

    if (SepText.#THE_ONE) {
      throw new Error('Use `SepText.THE_ONE`.');
    }
  }

  /** @override */
  get length() {
    return 0;
  }

  /** @override */
  toString() {
    return '';
  }


  //
  // Static members
  //

  /**
   * The unique instance of this class, if made.
   *
   * @type {?SepText}
   */
  static #THE_ONE = null;

  /** @returns {SepText} The unique instance of this class. */
  static get THE_ONE() {
    if (!SepText.#THE_ONE) {
      SepText.#THE_ONE = new SepText();
    }

    return SepText.#THE_ONE;
  }
}
