// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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
   * @param {...*} rest_unused Anything that one wants to be "used."
   */
  static abstract(...rest_unused) {
    throw new Error('Abstract method.');
  }
}
