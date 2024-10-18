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
 * Companion class of {@link BaseValueVisitor}, which represents the result of a
 * visit of a value that had been visited elsewhere during a visit.
 *
 * Along with just having a record of the shared nature of the structure,
 * instances of this class are also instrucmental in "breaking" circular
 * references during visits, making it possible to fully visit values that have
 * such circular references. See {@link BaseValueVisitor#_impl_shouldRef} for
 * more details.
 */
export class VisitRef extends BaseDefRef {
  // @defaultConstructor

  /** @override */
  get ref() {
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
    return { '@ref': this.index };
  }
}
