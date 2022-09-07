// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import * as util from 'node:util';

/**
 * Directive `$ref`, for looking up something from the `$defs`.
 */
export class RefDirective extends JsonDirective {
  /** {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /** {?DefsDirective} The `$defs` directive, if known. */
  #defs = null;

  /**
   * Constructs an instance.
   *
   * @param {ExpanderWorkspace} workspace The associated workspace.
   */
  constructor(workspace) {
    super(workspace);
    this.#workspace = workspace;
  }

  /** @override */
  process(pass, path, value) {
    if (pass !== 2) {
      if (typeof value !== 'string') {
        throw new Error(`Bad value for reference at ${util.format('%o', path)}`);
      } else if (!value.startsWith('#/$defs/')) {
        throw new Error(`Bad syntax for reference: ${value}`);
      }
      return { same: true };
    }

    const { name } = value.match(/^#[/][$]defs[/](?<name>.*)$/).groups;

    if (!this.#defs) {
      this.#defs = this.#workspace.getDirective('$defs');
    }

    return {
      replace: this.#defs.getDef(name),
      outer:   true
    };
  }


  //
  // Static members
  //

  /** @override */
  static get NAME() {
    return '$ref';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze(['$defs']);
  }
}
