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
   * @type {?object} Directive replacement value, if known. This is ultimately
   * the result of processing the `dirValue` as passed into the constructor.
   */
  #value = null;

  /** @type {boolean} Is {@link #value} ready? */
  #hasValue = false;

  /** @type {?object[]} Items that need to be enqueued during processing. */
  #queueItems;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    super(workspace, path, dirArg, dirValue);

    console.log('##### DEFS AT %o', path);

    if (path.length !== 0) {
      throw new Error(`\`${DefsDirective.NAME}\` only allowed at top level.`);
    }

    DefsDirective.#instances.set(workspace, this);

    this.#queueItems = [
      {
        path:     ['<value>'],
        value:    dirValue,
        complete: (action, v) => {
          switch (action) {
            case 'delete': {
              // Weird result, but try to deal gracefully.
              this.#value = null;
              break;
            }
            case 'resolve': {
              this.#value = v;
              break;
            }
            default: {
              throw new Error(`Unrecognized completion action: ${action}`);
            }
          }
          this.#hasValue = true;
        }
      },
      {
        path:  ['<defs>'],
        value: dirArg,
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
    ];
  }

  /** @override */
  process() {
    if (this.#queueItems) {
      const items = this.#queueItems;
      this.#queueItems = null;
      return {
        action:  'again',
        enqueue: items
      };
    }

    if (!this.#hasValue) {
      return { action: 'again' };
    }

    return { action: 'resolve', value: this.#value };
  }

  /**
   * Processes a named reference.
   *
   * @param {string} name Reference name.
   * @returns {*} Replacement, as specified by {@link #process}.
   */
  #processRef(name) {
    if (!this.#hasDefs) {
      return { action: 'again' };
    }

    const def = this.#defs.get(name);

    if (!def) {
      console.log('\n################# DEFS:\n%o\n', this.#defs);
      throw new Error(`No definition for: ${name}`);
    }

    return { action: 'resolve', value: def };
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
  static get NAME() {
    return '$defs';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }

  /**
   * Processes a reference.
   *
   * @param {ExpanderWorkspace} workspace The workspace.
   * @param {string} path Path to the reference.
   * @returns {?{value: *}} Found value, or `null` if the definitions have
   *   possibly not yet been found.
   */
  static processRef(workspace, path) {
    MustBe.object(workspace, ExpanderWorkspace);
    MustBe.string(path);

    const instance = this.#instances.get(workspace);
    if (!instance) {
      throw new Error('Unregistered workspace.');
    }

    const { name } = path.match(/^#[/][$]defs[/](?<name>.*)$/).groups;
    if (!name) {
      throw new Error(`Bad syntax for reference: ${path}`);
    }

    return instance.#processRef(name);
  }
}
