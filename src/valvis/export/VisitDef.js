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
   * This instance's corresponding ref.
   *
   * @type {VisitRef}
   */
  #ref;

  /**
   * Constructs an instance.
   *
   * @param {number} index The reference index number.
   * @param {...*} rest Other arguments for the superclass constructor.
   */
  constructor(index, ...rest) {
    super(index, ...rest);

    this.#ref = new VisitRef(this);
  }

  /** @override */
  get def() {
    return this;
  }

  /** @override */
  get ref() {
    return this.#ref;
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
    return { '@def': [this.index, this.value] };
  }
}
