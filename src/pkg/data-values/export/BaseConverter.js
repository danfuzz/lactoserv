// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Methods } from '@this/typey';


/**
 * Base class for converters of all sorts (as defined by this module). These are
 * objects which know how to encode (some set of) arbitrary values into data
 * values, and vice versa. See the module `README.md` for a bit more detail.
 *
 * **Note:** Some converters are defined to throw errors when presented with
 * values or data which they can't handle. Others are defined to return the
 * special value {@link BaseConverter#UNHANDLED}.
 */
export class BaseConverter {
  // Note: The default constructor is fine here.

  /**
   * Decodes a data value into an arbitrary value.
   *
   * @abstract
   * @param {*} data The data value to convert.
   * @returns {*} The converted form, or the special value
   *   {@link BaseConverter#UNHANDLED} if `data` is not convertible by this
   *   instance and the instance is not configured to throw errors in such
   *   cases.
   */
  decode(data) {
    throw Methods.abstract(data);
  }

  /**
   * Encodes an arbitrary value into a data value.
   *
   * @abstract
   * @param {*} value The value to convert.
   * @returns {*} The converted form, or the special value
   *   {@link BaseConverter#UNHANDLED} if `value` is not convertible by this
   *   instance and the instance is not configured to throw errors in such
   *   cases.
   */
  encode(value) {
    throw Methods.abstract(value);
  }


  //
  // Static members
  //

  /** @type {symbol} Value for the exposed {@link #ENCODE}. */
  static #ENCODE = Symbol('BaseConverter.ENCODE');

  /** @type {symbol} Value for the exposed {@link #OMIT}. */
  static #OMIT = Symbol('BaseConverter.OMIT');

  /** @type {symbol} Value for the exposed {@link #UNHANDLED}. */
  static #UNHANDLED = Symbol('BaseConverter.UNHANDLED');

  /**
   * @type {symbol} Name of method to define, in order to specify custom value
   * encoding behavior on an instance.
   */
  static get ENCODE() {
    return this.#ENCODE;
  }

  /**
   * @type {symbol} Return value from an `encode()` method to indicate "omit
   * this."
   */
  static get OMIT() {
    return this.#OMIT;
  }

  /**
   * @returns {symbol} Special return value from `encode()` and `decode()`
   * methods to indicate "conversion not handled."
   */
  static get UNHANDLED() {
    return this.#UNHANDLED;
  }
}
