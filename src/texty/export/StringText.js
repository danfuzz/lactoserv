// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
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
}
