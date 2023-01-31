// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Methods } from '@this/typey';


/**
 * Base class for "special converters." These are objects which know how to
 * convert particular kinds of (other) objects or (generally) values to and from
 * data values.
 */
export class BaseConverter {
  // Note: The default constructor is fine here.

  /**
   * Converts the given (arbitrary) object or value to a data value, in whatever
   * way is appropriate.
   *
   * @abstract
   * @param {*} value The value to convert.
   * @returns {*} The converted form, or the special value {@link #UNHANDLED} if
   *   `value` is not convertible by this instance.
   */
  dataFromValue(value) {
    throw Methods.abstract(value);
  }

  /**
   * Reverses the operation of {@link #dataFromValue}.
   *
   * @abstract
   * @param {*} data The data value to convert.
   * @returns {*} The converted form, or the special value {@link #UNHANDLED} if
   *   `data` is not convertible by this instance.
   */
  valueFromData(data) {
    throw Methods.abstract(data);
  }


  //
  // Static members
  //

  /** @type {symbol} Special "unhandled" value. */
  static #UNHANDLED = Symbol('BaseConverter.UNHANDLED');

  /** @returns {symbol} Special return value from methods on this class. */
  static get UNHANDLED() {
    return this.#UNHANDLED;
  }
}
