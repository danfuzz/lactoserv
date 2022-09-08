// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { DefsDirective } from '#p/DefsDirective';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

/**
 * Directive `$ref`. See the package README for more details.
 */
export class RefDirective extends JsonDirective {
  /** @type {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /** @type {string} Name of the definition to look up. */
  #name;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.string(dirArg);
    super(workspace, path, dirArg, dirValue);

    if (Object.entries(dirValue).length !== 0) {
      throw new Error(`\`${RefDirective.NAME}\` does not accept additional object values.`);
    }

    const { name } = dirArg.match(/^#[/][$]defs[/](?<name>.*)$/).groups;
    if (!name) {
      throw new Error(`Bad syntax for reference: ${dirArg}`);
    }

    this.#workspace = MustBe.object(workspace, ExpanderWorkspace);
    this.#name      = name;
  }

  /** @override */
  process() {
    const defs = DefsDirective.getRootInstance(this.#workspace);

    if (!defs) {
      return { action: 'again' };
    }

    return { action: 'resolve', value: defs.get(this.#name) };
  }


  //
  // Static members
  //

  /** @override */
  static get ALLOW_OTHER_BINDINGS() {
    return false;
  }

  /** @override */
  static get NAME() {
    return '$ref';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze(['$defs']);
  }
}
