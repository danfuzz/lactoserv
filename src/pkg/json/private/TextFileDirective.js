// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseDirDirective } from '#p/BaseDirDirective';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

/**
 * Directive `$textFile`. See the package README for more details.
 */
export class TextFileDirective extends JsonDirective {
  /** @type {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /** @type {string} The (possibly-relative) file path. */
  #filePath;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.string(dirArg);
    super(workspace, path, dirArg, dirValue);

    this.#workspace = workspace;
    this.#filePath  = dirArg;
  }

  /** @override */
  process() {
    if (!this.#filePath.match(/^[/]/)) {
      // It's a relative path, so we need to get the base directory.
      const baseDir = BaseDirDirective.getDir(this.#workspace);

      if (baseDir === null) {
        return { action: 'again' };
      }

      this.#filePath = Path.resolve(baseDir, this.#filePath);
    }

    return {
      action: 'resolve',
      value:  fs.readFile(this.#filePath, 'utf-8'),
      await:  true
    };
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
    return '$textFile';
  }

  /** @override */
  static get NAMED_ARGS() {
    return [];
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze(['$baseDir']);
  }
}
