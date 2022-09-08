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

  /** @type {string} Path to the value. */
  #refPath;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    super(workspace, path, dirArg, dirValue);

    if (Object.entries(dirValue).length !== 0) {
      throw new Error(`\`${RefDirective.NAME}\` does not accept additional object values.`);
    }

    this.#workspace = MustBe.object(workspace, ExpanderWorkspace);
    this.#refPath   = MustBe.string(dirArg);
  }

  /** @override */
  process() {
    return DefsDirective.processRef(this.#workspace, this.#refPath);
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
