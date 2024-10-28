// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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
   * The entry which is being referred to.
   *
   * @type {VisitEntry}
   */
  #entry;

  /**
   * Constructs an instance. Note that the first parameter is an instance of a
   * private inner class of {@link BaseValueVisitor}, and as such, this
   * constructor isn't usable publicly.
   *
   * @param {number} index The reference index number.
   * @param {?VisitEntry} entry The visit-in-progress entry representing the
   *   original visit, or `null` if there is no associated entry. (The latter
   *   case is mostly intended for testing scenarios.)
   */
  constructor(index, entry) {
    this.#index = index;
    this.#entry = entry;
  }

  /**
   * @returns {?VisitDef} The def corresponding to this instance. This is `this`
   * if this instance is in fact a def.
   *
   * **Note:** This is only ever `null` when the instance was constructed with
   * `entry === null`.
   */
  get def() {
    return this.#entry?.def ?? null;
  }

  /**
   * @returns {?VisitRef} The ref corresponding to this instance. This is `this`
   * if this instance is in fact a ref.
   *
   * **Note:** This is only ever `null` when the instance was constructed with
   * `entry === null`.
   */
  get ref() {
    return this.#entry?.ref ?? null;
  }

  /**
   * @returns {number} The reference index number. Each instance of this class
   * used within a particular visitor has a unique index number.
   */
  get index() {
    return this.#index;
  }

  /**
   * @returns {*} The original value (not the visit result) which this
   * instance is a reference to.
   */
  get originalValue() {
    return this.#entry?.originalValue ?? null;
  }

  /**
   * @returns {*} The result value of the visit.
   * @throws {Error} Thrown if the visit was unsuccessful or is still in
   *   progress.
   */
  get value() {
    return this.#entry?.extractSync() ?? null;
  }

  /**
   * Is this instance associated with the given visitor?
   *
   * @param {BaseValueVisitor} visitor The visitor in question.
   * @returns {boolean} `true` if this instance's associated visitor is in fact
   *   `visitor`.
   */
  isAssociatedWith(visitor) {
    return this.#entry?.isAssociatedWith(visitor) ?? false;
  }

  /**
   * Indicates whether or not the visit of the referenced value is finished and
   * has a result value or error.
   *
   * @returns {boolean} `true` if the visit of the referenced value is finished,
   *   or `false` if it is still in-progress.
   */
  isFinished() {
    return this.#entry?.isFinished() ?? false;
  }
}
