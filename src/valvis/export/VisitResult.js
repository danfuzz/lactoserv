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
 * Companion class of {@link BaseValueVisitor}, which holds the result from a
 * visit.
 *
 * This class exists to avoid ambiguity when promises are used as the
 * result-per-se from a visit (or sub-visit), as opposed to being used because
 * of the JavaScript execution semantics involved in implementing a visitor
 * method as `async`.
 */
export class VisitResult {
  /**
   * The visit result value.
   *
   * @type {*}
   */
  #value;

  /**
   * Constructs an instance.
   *
   * @param {*} value The visit result.
   */
  constructor(value) {
    this.#value = value;
  }

  /** @returns {*} The visit result. */
  get value() {
    return this.#value;
  }
}
