// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';

/**
 * Forward declaration of this class, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef BaseValueVisitor
 * @type {object}
 */

/**
 * Forward declaration of this class, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef VisitDef
 * @type {object}
 */

/**
 * Declaration of the class `BaseValueVisitor.#VisitEntry` for documentation
 * purposes. The class isn't exposed publicly.
 *
 * @typedef VisitEntry
 * @type {object}
 */

/**
 * Forward declaration of this class, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef VisitRef
 * @type {object}
 */

/**
 * Base class of {@link VisitDef} and {@link VisitRef}, for ease of `instanceof`
 * (because often one doesn't care which one one has) and for common
 * implementation details.
 */
export class BaseDefRef {
  /**
   * The reference index number.
   *
   * @type {number}
   */
  #index;

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
   * Constructs an instance. Note that the first parameter is an instance of a
   * private inner class of {@link BaseValueVisitor}, and as such, this
   * constructor isn't usable publicly.
   *
   * @param {number} index The reference index number.
   * @param {?VisitEntry} entry_ignored The visit-in-progress entry representing
   *   the original visit, or `null` if there is no associated entry. (The
   *   latter case is mostly intended for testing scenarios.)
   * @param {*} [value] The already-known associated value. If not passed, the
   *   value is treated as not yet known, which relatedly means that the
   *   associated (sub-)visit is not yet finished.
   */
  constructor(index, entry_ignored, value = BaseDefRef.#SYM_notFinished) {
    this.#index = index;
    this.#error = null;

    if (value === BaseDefRef.#SYM_notFinished) {
      this.#value    = null;
      this.#finished = false;
    } else {
      this.#value    = value;
      this.#finished = true;
    }
  }

  /**
   * @abstract
   * @returns {?VisitDef} The def corresponding to this instance. This is `this`
   * if this instance is in fact a def.
   */
  get def() {
    throw Methods.abstract();
  }

  /**
   * @abstract
   * @returns {?VisitRef} The ref corresponding to this instance. This is `this`
   * if this instance is in fact a ref.
   */
  get ref() {
    throw Methods.abstract();
  }

  /**
   * @returns {number} The reference index number. Each instance of this class
   * used within a particular visitor has a unique index number.
   */
  get index() {
    return this.#index;
  }

  /**
   * @returns {*} The result value of the visit.
   * @throws {Error} Thrown if the visit was unsuccessful or is still in
   *   progress.
   */
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

  /**
   * Indicates whether or not the visit of the referenced value is finished and
   * has a result value or error.
   *
   * @returns {boolean} `true` if the visit of the referenced value is finished,
   *   or `false` if it is still in-progress.
   */
  isFinished() {
    return this.#finished;
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
