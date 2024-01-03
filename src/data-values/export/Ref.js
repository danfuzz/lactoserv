// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { BaseDataClass } from '#x/BaseDataClass';


/**
 * "Data" value that wraps (or "escapes") a non-data value as an opaque
 * "reference," allowing it to live undisturbed in a given data-value conversion
 * context.
 *
 * Instances of this class are always frozen.
 */
export class Ref extends BaseDataClass {
  /** @type {*} The wrapped value. */
  #value;

  /**
   * Constructs an instance.
   *
   * @param {*} value The wrapped value.
   */
  constructor(value) {
    super();

    this.#value = value;

    Object.freeze(this);
  }

  /** @returns {*} The wrapped value. */
  get value() {
    return this.#value;
  }

  /** @override */
  toEncodableValue() {
    return null;
  }

  /** @override */
  withEncodedValue(innerValue_unused) {
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
      return '[Ref]';
    }

    const innerOptions = Object.assign({}, options, {
      depth: (options.depth === null) ? null : options.depth - 1
    });

    return `Ref { ${inspect(this.#value, innerOptions)} }`;
  }
}
