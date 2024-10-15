// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';


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
   * @returns {Array} Reconstruction class and arguments.
   */
  deconstruct() {
    throw Methods.abstract();
  }
}
