// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

/**
 * Utilities for type-checking methods.
 */
export class Methods {
  /**
   * "Declares" a method to be abstract. This just throws an error. That said,
   * it can also be passed arbitrary values so that parameters in the caller
   * won't be considered unused and so can be documented with their natural
   * names.
   *
   * The suggested use of this is to say `throw Methods.abstract(...)` to make
   * it clear at the call site that it in fact throws.
   *
   * @param {...*} rest_unused Anything that one wants to be "used."
   */
  static abstract(...rest_unused) {
    throw new Error('Abstract method.');
  }
}
