// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfText } from '#x/IntfText';
import { TypeText } from '#x/TypeText';


/**
 * Text class that just wraps a regular string, which is expected to be
 * unstyled.
 */
export class StringText extends IntfText {
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
