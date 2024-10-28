// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseDefRef } from '#x/BaseDefRef';
import { VisitRef } from '#x/VisitRef';


/**
 * Forward declaration of this class, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef BaseValueVisitor
 * @type {object}
 */

/**
 * Companion class of {@link BaseValueVisitor}, which represents the defining
 * occurrence of a result of a (sub-)visit which appears more than once in an
 * overall visit result.
 */
export class VisitDef extends BaseDefRef {
  /**
   * The value being referred to, or `null` if not yet known.
   *
   * @type {*} value
   */
  #value;

  /**
   * The error resulting from the visit, or `null` if there was none _or_ it is
   * not yet  known.
   *
   * @type {?Error}
   */
  #error;

  /**
   * Is the visit finished? Relatedly, are {@link #value} and {@link #error}
   * known?
   *
   * @type {boolean}
   */
  #finished;

  /**
   * This instance's corresponding ref.
   *
   * @type {VisitRef}
   */
  #ref;

  /**
   * Constructs an instance.
   *
   * @param {number} index The reference index number.
   * @param {*} [value] The already-known associated value. If not passed, the
   *   value is treated as not yet known, which relatedly means that the
   *   associated (sub-)visit is not yet finished.
   */
  constructor(index, value = VisitDef.#SYM_notFinished) {
    super(index);

    this.#ref   = new VisitRef(this);
    this.#error = null;

    if (value === VisitDef.#SYM_notFinished) {
      this.#value    = null;
      this.#finished = false;
    } else {
      this.#value    = value;
      this.#finished = true;
    }
  }

  /** @override */
  get def() {
    return this;
  }

  /** @override */
  get error() {
    return this.#error;
  }

  /** @override */
  get ref() {
    return this.#ref;
  }

  /** @override */
  get value() {
    if (!this.#finished) {
      throw new Error('Not yet finished.');
    } else if (this.#error) {
      throw this.#error;
    } else {
      return this.#value;
    }
  }

  /**
   * Indicates that this instance's visit has now finished unsuccessfully with
   * the given error. It is only ever valid to call this on an unfinished
   * instance.
   *
   * @param {Error} error The error.
   */
  finishWithError(error) {
    if (this.#finished) {
      throw new Error('Already finished.');
    }

    this.#finished = true;
    this.#error    = error;
  }

  /**
   * Indicates that this instance's visit has now finished successfully with the
   * given result value. It is only ever valid to call this on an unfinished
   * instance.
   *
   * @param {*} value The result value.
   */
  finishWithValue(value) {
    if (this.#finished) {
      throw new Error('Already finished.');
    }

    this.#finished = true;
    this.#value    = value;
  }

  /** @override */
  isFinished() {
    return this.#finished;
  }

  /**
   * Implementation of the standard `JSON.stringify()` replacement interface.
   *
   * **Note:** This is not intended for high-fidelity data encoding, in that the
   * result is ambiguous with plain objects that happen to have the same shape
   * as this method's results. The main intended use case for this is logging.
   *
   * @param {?string} key_unused The property name / stringified index where the
   *   instance was fetched from.
   * @returns {*} The replacement form to encode.
   */
  toJSON(key_unused) {
    const valueArg = this.#finished ? [this.value] : [];
    return { '@def': [this.index, ...valueArg] };
  }


  //
  // Static members
  //

  /**
   * Special uninterned symbol used in the constructor in order to distinguish
   * whether the `value` argument was passed.
   *
   * @type {symbol}
   */
  static #SYM_notFinished = Symbol('BaseDefRef.notFinished');
}
