// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

/**
 * Directive `$baseDir`, for defining a base directory in the filesystem for the
 * resolution of relative filesystem paths in other directives.
 */
export class BaseDirDirective extends JsonDirective {
  /** {?string} The base directory, if known. */
  #baseDir = null;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    super(workspace, path, dirArg, dirValue);
  }

  /**
   * @returns {string} The base directory.
   */
  get value() {
    if (this.#baseDir === null) {
      throw new Error('Base directory not (yet) known.');
    }

    return this.#baseDir;
  }

  /** @override */
  process(pass, path, value) {
    if (pass !== 1) {
      return { same: true };
    }

    if (path.length === 1) {
      MustBe.string(value, /^[/].*[^/]/);
      this.#baseDir = value;
      return { delete: true };
    } else {
      throw new Error(`\`${BaseDirDirective.NAME}\` only allowed at top level.`);
    }
  }


  //
  // Static members
  //

  /** @override */
  static get NAME() {
    return '$baseDir';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }
}
