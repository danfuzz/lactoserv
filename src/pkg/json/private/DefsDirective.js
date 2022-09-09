// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

/**
 * Directive `$def`. See the package README for more details.
 */
export class DefsDirective extends JsonDirective {
  /** @type {Map<string, *>} Map of replacements. */
  #defs = null;

  /** @type {boolean} Is {@link #defs} ready? */
  #hasDefs = false;

  /**
   * @type {object} The processing action to be reported back to the workspace.
   */
  #actionResult;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    super(workspace, path, dirArg, dirValue);

    if (path.length !== 0) {
      throw new Error(`\`${DefsDirective.NAME}\` only allowed at top level.`);
    }

    DefsDirective.#registerRootInstance(workspace, this);

    this.#actionResult = {
      action:  'again',
      value:   dirValue,
      enqueue: [
        {
          path:     ['<defs>'],
          value:    dirArg,
          complete: (action, v) => {
            switch (action) {
              case 'delete': {
                // Weird result, but try to deal gracefully.
                this.#defs = new Map();
                break;
              }
              case 'resolve': {
                this.#defs = new Map(Object.entries(v));
                break;
              }
              default: {
                throw new Error(`Unrecognized completion action: ${action}`);
              }
            }
            this.#hasDefs = true;
          }
        }
      ]
    };
  }

  /**
   * Gets the definition associated with the given name.
   *
   * @param {string} name The name to look up.
   * @returns {*} The associated value.
   * @throws {Error} Thrown if there is no binding for `name`.
   */
  get(name) {
    const result = this.#defs.get(name);

    if (result === undefined) {
      throw new Error(`No definition for: ${name}`);
    }

    return result;
  }

  /** @override */
  process() {
    return this.#actionResult;
  }


  //
  // Static members
  //

  /**
   * @type {WeakMap<ExpanderWorkspace, DefsDirective>} Weak map from workspaces
   * to corresponding instances of this class.
   */
  static #instances = new WeakMap();

  /** @override */
  static get ALLOW_OTHER_BINDINGS() {
    return true;
  }

  /** @override */
  static get NAME() {
    return '$defs';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }

  /**
   * Gets the instance of this class associated with the root of the given
   * workspace, if known _and_ has definitions.
   *
   * @param {ExpanderWorkspace} workspace The workspace.
   * @returns {?DefsDirective} The associated directive, if known and ready.
   */
  static getRootInstance(workspace) {
    MustBe.object(workspace, ExpanderWorkspace);

    const instance = this.#instances.get(workspace);

    return (instance && instance.#hasDefs) ? instance : null;
  }

  /**
   * Registers a top-level instance.
   *
   * @param {ExpanderWorkspace} workspace The workspace.
   * @param {DefsDirective} instance The instance.
   */
  static #registerRootInstance(workspace, instance) {
    if (this.#instances.has(workspace)) {
      throw new Error(`Another ${this.NAME} is already registered.`);
    }

    this.#instances.set(workspace, instance);
  }
}
