// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Utilities for JSON.
 */
export class JsonUtil {
  //
  // Static members
  //

  /**
   * Parses a string as JSON, returning a deep-frozen value. Other than the
   * fact of deep-frozenness, this method behaves mostly just like
   * `JSON.parse(text)`. The one difference is that it type-checks its input.
   *
   * @param {string} text JSON text to parse.
   * @returns {*} The parsed value.
   */
  static parseAndFreeze(text) {
    MustBe.string(text);
    return JSON.parse(text, (key_unused, value) => Object.freeze(value));
  }
}
