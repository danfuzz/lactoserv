// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';

import { Sexp } from '#x/Sexp';


/**
 * Interface which indicates that an instance can be "deconstructed" into a
 * constructor class along with its arguments.
 *
 * @interface
 */
export class IntfDeconstructable {
  // @defaultConstructor

  /**
   * Returns the constructor function and arguments to use in order to construct
   * a new instance which could reasonably be considered to be "equal" to this
   * one. Specifically, the following should cause `newInstance` to refer to
   * such an instance:
   *
   * ```js
   * const [cls, ...args] = this.deconstruct();
   * const newInstance = new cls(...args);
   * ```
   *
   * @abstract
   * @param {boolean} [forLogging] Hint which, if `true`, indicates that the
   *   result is intended for logging (and as such might want to have a form
   *   that includes details not strictly necessary for reconstruction).
   *   Defaults to `false`.
   * @returns {Sexp} Reconstruction class and arguments.
   */
  deconstruct(forLogging) { // eslint-disable-line no-unused-vars
    throw Methods.abstract();
  }
}
