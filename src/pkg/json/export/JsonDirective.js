// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';

/**
 * Base class for directives used by {@link JsonExpander}.
 */
export class JsonDirective {
  /**
   * Process the given directive value. Each directive is called twice, once
   * with `pass === 1` and then again with `pass === 2`.
   *
   * @abstract
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, indicated as an object with
   *   one of these bindings:
   *   `delete: true` -- The key/value pair (or array element) should be removed
   *     from the enclosing object (or array).
   *   `replace: <value>` -- `value` should be used to replace the original
   *     binding. With no additional properties, just the binding for the
   *     directive name is to be replaced. With additional property `outer:
   *     true`, the enclosing object should be replaced, not just the directive
   *     property.
   *   `replaceAwait: <promise>` -- The value should be replaced with the
   *     asynchrounously yielded result from the given promise. This form is
   *     only accepted when the outer {@link JsonExpander} is being run
   *     asynchronously.
   *   `same: true` -- The value should remain unchanged.
   * @returns {*} Result, as per {@link ExpanderWorkspace.process}.
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
