// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';

/**
 * Forward declaration of this class, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef VisitDef
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
   * Constructs an instance.
   *
   * @param {number} index The reference index number.
   */
  constructor(index) {
    this.#index = index;
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
   * @abstract
   * @returns {*} The result value of the visit.
   * @throws {Error} Thrown if the visit was unsuccessful or is still in
   *   progress.
   */
  get value() {
    throw Methods.abstract();
  }

  /**
   * Indicates whether or not the visit of the referenced value is finished and
   * has a result value or error.
   *
   * @abstract
   * @returns {boolean} `true` if the visit of the referenced value is finished,
   *   or `false` if it is still in-progress.
   */
  isFinished() {
    throw Methods.abstract();
  }
}
