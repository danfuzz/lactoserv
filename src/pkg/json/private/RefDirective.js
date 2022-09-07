// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { DefsDirective } from '#p/DefsDirective';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

import * as util from 'node:util';

/**
 * Directive `$ref`, for looking up something from the `$defs`.
 */
export class RefDirective extends JsonDirective {
  /** @type {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /** @type {string} Path to the value. */
  #refPath;

  constructor(workspace, path, dirArg, dirValue) {
    super();
    console.log('##### REFS AT %o :: %s', path, dirArg);
    if (Object.entries(dirValue).length !== 0) {
      throw new Error(`\`${RefsDirective.NAME}\` does not accept additional object values.`);
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
