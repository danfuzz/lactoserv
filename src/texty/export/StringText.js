// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseText } from '#x/BaseText';


/**
 * Text class that just wraps a regular string, which is expected to be
 * unstyled.
 */
export class StringText extends BaseText {
  /**
   * The string.
   *
   * @type {string}
   */
  #value;

  /**
   * Constructs an instance.
   *
   * @param {string} value The string.
   */
  constructor(value) {
    super();
    this.#value = value;
  }

  /** @override */
  get length() {
    return this.#value.length;
  }

  /** @override */
  toString() {
    return this.#value;
  }

  /** @override */
  _impl_renderMultiline(options) {
    // What's going on: If the string is just spaces and we're at the beginning
    // of a line, then we don't render anything. This handles cases like
    // splitting at the commas or braces in `{ x: 10, y: 20 }`.

    const { atColumn } = options;

    return ((atColumn === -1) && /^ *$/.test(this.#value))
      ? { endColumn: atColumn, value: '' }
      : super._impl_renderMultiline(options);
  }
}
