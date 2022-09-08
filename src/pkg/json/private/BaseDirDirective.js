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

  /** @type {?object[]} Items that need to be enqueued during processing. */
  #queueItems;

  /**
   * @type {?object} Directive replacement value, if known. This is ultimately
   * the result of processing the `dirValue` as passed into the constructor.
   */
  #value = null;

  /** @type {boolean} Is {@link #value} ready? */
  #hasValue = false;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.string(dirArg);
    super(workspace, path, dirArg, dirValue);

    console.log('##### BASE DIR AT %o', path);

    if (path.length !== 0) {
      throw new Error(`\`${BaseDirDirective.NAME}\` only allowed at top level.`);
    }

    BaseDirDirective.#instances.set(workspace, this);

    this.#baseDir = dirValue;

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
      }
    ];
  }

  /**
   * @returns {string} The base directory.
   */
  get value() {
    return this.#baseDir;
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


  //
  // Static members
  //

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
