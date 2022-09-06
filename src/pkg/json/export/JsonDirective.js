// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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
    Methods.abstract(pass, path, value);
  }
}
