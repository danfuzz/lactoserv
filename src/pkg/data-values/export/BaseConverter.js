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
   * Decodes a data value into an arbitrary value, as appropriate for this
   * special converter instance.
   *
   * @abstract
   * @param {*} data The data value to convert.
   * @returns {*} The converted form, or the special value
   *   {@link Converter#UNHANDLED} if `data` is not convertible by this
   *   instance.
   */
  decode(data) {
    throw Methods.abstract(data);
  }

  /**
   * Encodes an arbitrary value to a data value, as appropriate for this special
   * converter instance.
   *
   * @abstract
   * @param {*} value The value to convert.
   * @returns {*} The converted form, or the special value
   *   {@link Converter#UNHANDLED} if `value` is not convertible by this
   *   instance.
   */
  encode(value) {
    throw Methods.abstract(value);
  }
}
