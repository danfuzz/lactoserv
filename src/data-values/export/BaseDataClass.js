// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';


/**
 * Base class for all classes which are considered to be peer data value types
 * to the "real" data value types of JavaScript (number, string, plain object,
 * array, etc.). Note that {@link ConverterConfig} lets one specify which actual
 * classes are to be treated as data values, but whatever classes are in that
 * set are all expected to inherit from this base class.
 */
export class BaseDataClass {
  /**
   * Gets the "inner value" of this instance, which is suitable for encoding, to
   * produce a converted instance of this class.
   *
   * @abstract
   * @returns {*} Encodable inner value.
   */
  toEncodableValue() {
    Methods.abstract();
  }

  /**
   * Gets an instance just like this one, but with the given replacement inner
   * value, and _never_ frozen unless all instances of this (concrete) class are
   * always frozen.
   *
   * @abstract
   * @param {*} innerValue The new inner value.
   * @returns {*} A replacement instance for this one, such that `innerValue` is
   *   represented.
   */
  withEncodedValue(innerValue) {
    Methods.abstract(innerValue);
  }
}
