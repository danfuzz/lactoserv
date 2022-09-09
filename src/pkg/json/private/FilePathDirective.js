// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseDirDirective } from '#p/BaseDirDirective';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

import * as Path from 'node:path';

/**
 * Directive `$filePath`. See the package README for more details.
 */
export class FilePathDirective extends JsonDirective {
  /** @type {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /** @type {string} The (possibly-relative) original file path. */
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
    const filePath = this.#filePath;

    if (filePath.match(/^[/]/)) {
      // It's an absolute path, resolve it just to clear up `.`s and `..`s.
      return {
        action: 'resolve',
        value:  Path.resolve(filePath)
      }
    } else {
      // It's a relative path, so we need to get the base directory.
      const baseDir = BaseDirDirective.getDir(this.#workspace);

      if (baseDir === null) {
        return { action: 'again' };
      }

      return {
        action: 'resolve',
        value:  Path.resolve(baseDir, filePath)
      }
    }
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
    return '$filePath';
  }

  /** @override */
  static get NAMED_ARGS() {
    return [];
  }

  /** @override */
  static get REQUIRES() {
    return ['$baseDir'];
  }
}
