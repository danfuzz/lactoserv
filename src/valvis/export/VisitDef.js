// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseDefRef } from '#x/BaseDefRef';


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
  // @defaultConstructor

  /** @override */
  get def() {
    return this;
  }

  /**
   * Implementation of the standard `JSON.stringify()` replacement interface.
   *
   * @param {?string} key_unused The property name / stringified index where the
   *   instance was fetched from.
   * @returns {string} The string form.
   */
  toJSON(key_unused) {
    return { '@def': [this.index, this.value] };
  }
}
