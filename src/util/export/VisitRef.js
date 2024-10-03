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
 * Declaration of the class `BaseValueVisitor.#VisitEntry` for documentation
 * purposes. The class isn't exposed publicly.
 *
 * @typedef VisitEntry
 * @type {object}
 */

/**
 * Companion class of {@link BaseValueVisitor}, which represents the result of a
 * visit of a value that had been visited elsewhere during a visit.
 *
 * Along with just having a record of the shared nature of the structure,
 * instances of this class are also instrucmental in "breaking" circular
 * references during visits, making it possible to fully visit values that have
 * such circular references. See {@link BaseValueVisitor#shouldRef} for more
 * details.
 */
export class VisitRef {
  /**
   * The entry which is being referred to.
   *
   * @type {VisitEntry}
   */
  #entry;

  /**
   * The reference index number.
   *
   * @type {number}
   */
  #index;

  /**
   * Constructs an instance. Note that the first parameter is an instance of a
   * private inner class of {@link BaseValueVisitor}, and as such, this
   * constructor isn't usable publicly.
   *
   * @param {VisitEntry} entry The visit-in-progress entry representing the
   *   original visit.
   * @param {number} index The reference index number.
   */
  constructor(entry, index) {
    this.#entry = entry;
    this.#index = index;
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
    return this.#entry.originalValue;
  }

  /**
   * @returns {*} The result value of the visit. This will throw an error if
   * the visit was unsuccessful.
   */
  get value() {
    return this.#entry.extractSync();
  }
}
