// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

/**
 * Directive `$baseDir`. See the package README for more details.
 */
export class BaseDirDirective extends JsonDirective {
  /** @type {string} The base directory. */
  #baseDir;

  /**
   * @type {object} The processing action to be reported back to the workspace.
   */
  #actionResult;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.string(dirArg, BaseDirDirective.#BASE_DIR_REGEXP);
    super(workspace, path, dirArg, dirValue);

    if (path.length !== 0) {
      throw new Error(`\`${BaseDirDirective.NAME}\` only allowed at top level.`);
    }

    BaseDirDirective.#instances.set(workspace, this);

    this.#baseDir      = dirArg;
    this.#actionResult = {
      action: 'again',
      value:  dirValue
    };
  }

  /**
   * @returns {string} The base directory.
   */
  get value() {
    return this.#baseDir;
  }

  /** @override */
  process() {
    return this.#actionResult;
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
  static get ALLOW_OTHER_BINDINGS() {
    return true;
  }

  /** @override */
  static get NAME() {
    return '$baseDir';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }

  /**
   * Gets the base directory associated with the given workspace, if known.
   *
   * @param {ExpanderWorkspace} workspace The workspace.
   * @returns {?string} The base directory, or `null` if not yet known.
   */
  static getDir(workspace) {
    MustBe.object(workspace, ExpanderWorkspace);

    const instance = this.#instances.get(workspace);
    return instance ? instance.value : null;
  }
}
