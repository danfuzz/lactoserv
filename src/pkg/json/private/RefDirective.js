// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

/**
 * Directive `$ref`, for looking up something from the `$defs`.
 */
export class RefDirective extends JsonDirective {
  /** {Workspace} Associated workspace. */
  #workspace;

  /** {?DefsDirective} The `$defs` directive, if known. */
  #defs = null;

  /**
   * Constructs an instance.
   *
   * @param {Workspace} workspace The associated workspace.
   */
  constructor(workspace) {
    super();
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
      return value;
    }

    const { name } = value.match(/^#[/][$]defs[/](?<name>.*)$/).groups;

    if (!this.#defs) {
      this.#defs = this.#workspace.getDirective('$defs');
    }

    return { $replaceOuter: this.#defs.getDef(name) };
  }


  //
  // Static members
  //

  /** @type {string} Name of this directive. */
  static get NAME() {
    return '$ref';
  }
}
