// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


import { Methods } from '@this/typey';

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
   * @abstract
   * @returns {string} The simple string value of this instance, including any
   *   style/color escapes, for use in rendering as a single line.
   */
  toString() {
    throw Methods.abstract();
  }
}
