// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

/**
 * Directive `$baseDir`. See the package README for more details.
 */
export class BaseDirDirective extends JsonDirective {
  /** @type {?string} The base directory. */
  #baseDir;

  /**
   * @type {object} The unprocessed value, which is to be expanded to produce
   * the replacement for this directive
   */
  #unprocessedValue;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.string(dirArg, BaseDirDirective.#BASE_DIR_REGEXP);
    super(workspace, path, dirArg, dirValue);

    if (path.length !== 0) {
      throw new Error(`\`${BaseDirDirective.NAME}\` only allowed at top level.`);
    }

    BaseDirDirective.#instances.set(workspace, this);

    this.#baseDir          = dirArg;
    this.#unprocessedValue = dirValue;
  }

  /**
   * @returns {string} The base directory.
   */
  get value() {
    return this.#baseDir;
  }

  /** @override */
  process() {
    return {
      action: 'again',
      value:  this.#unprocessedValue
    }
  }


  //
  // Static members
  //

  /**
   * @type {RegExp} Pattern which matches only valid base directory paths, as
   * specified by this class.
   */
  static #BASE_DIR_REGEXP;
  static {
    const pattern =
      '^' +
      '(?!.*//)' +        // No double-or-more slashes.
      '(?!.*/[.][.]?/)' + // No `.` or `..` component at the start or middle.
      '/(.*[^/])?' +      // Be just `/`, or start but not end with `/`.
      '(?<!/[.][.]?)' +   // No `.` or `..` component at the end.
      '$';

    this.#BASE_DIR_REGEXP = new RegExp(pattern);
  }

  /**
   * @type {WeakMap<ExpanderWorkspace, BaseDirDirective>} Weak map from
   * workspaces to corresponding instances of this class.
   */
  static #instances = new WeakMap();

  /** @override */
  static get NAME() {
    return '$baseDir';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }
}
