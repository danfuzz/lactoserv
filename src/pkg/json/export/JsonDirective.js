// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';

/**
 * Base class for directives used by {@link JsonExpander}.
 */
export class JsonDirective {
  /**
   * Process the given directive value.
   *
   * @abstract
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {*} Result, as per {@link Workspace.process}.
   */
  process(pass, path, value) {
    throw Methods.abstract(pass, path, value);
  }


  //
  // Static members
  //

  /**
   * @abstract
   * @returns {string} Name of this directive.
   */
  static get NAME() {
    throw Methods.abstract();
  }

  /**
   * @abstract
   * @returns {string[]} Names of directives that this one depends on.
   */
  static get REQUIRES() {
    throw Methods.abstract();
  }
}
