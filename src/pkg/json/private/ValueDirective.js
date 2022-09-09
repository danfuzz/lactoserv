// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

/**
 * Directive `$value`. See the package README for more details.
 */
export class ValueDirective extends JsonDirective {
  /**
   * @type {object} The processing action to be reported back to the workspace.
   */
  #actionResult;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    super(workspace, path, dirArg, dirValue);

    this.#actionResult = {
      action: 'again',
      value:  dirArg
    };
  }

  /** @override */
  process() {
    return this.#actionResult;
  }


  //
  // Static members
  //

  /** @override */
  static get ALLOW_EXTRA_BINDINGS() {
    return false;
  }

  /** @override */
  static get NAME() {
    return '$value';
  }

  /** @override */
  static get NAMED_ARGS() {
    return [];
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }
}
