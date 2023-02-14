// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';


/**
 * "Data" value that wraps (or "escapes") a non-data value, allowing it to live
 * undisturbed in a given data-value conversion context.
 *
 * Instances of this class are always frozen.
 */
export class NonData {
  /** @type {*} The wrapped value. */
  #value;

  /**
   * Constructs an instance.
   *
   * @param {*} value The wrapped value.
   */
  constructor(value) {
    this.#value = value;

    Object.freeze(this);
  }

  /** @returns {*} The wrapped value. */
  get value() {
    return this.#value;
  }

  /**
   * Gets the "inner value" of this instance, which is suitable for conversion,
   * to produce a converted instance of this class.
   *
   * @returns {*} Convertible inner value.
   */
  toConvertibleValue() {
    return null;
  }

  /**
   * Gets an instance just like this one, but with the given replacement
   * inner value.
   *
   * @param {*} innerValue_unused The new inner value.
   * @returns {*} A replacement instance for this one, representing its
   *   conversion.
   */
  withConvertedValue(innerValue_unused) {
    return this;
  }

  /**
   * Custom inspector for instances of this class.
   *
   * @param {number} depth Maximum depth to inspect to.
   * @param {object} options Inspection options.
   * @param {Function} inspect Inspector function to use for sub-inspection.
   * @returns {string} The inspected form.
   */
  [util.inspect.custom](depth, options, inspect) {
    if (depth < 0) {
      return '[NonData]';
    }

    const innerOptions = Object.assign({}, options, {
      depth: (options.depth === null) ? null : options.depth - 1
    });

    return `NonData { ${inspect(this.#value, innerOptions)} }`;
  }
}
