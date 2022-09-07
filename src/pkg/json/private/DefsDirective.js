// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

/**
 * Directive `$defs`, for defining a dictionary of replacements.
 */
export class DefsDirective extends JsonDirective {
  /** {Map<string, *>} Map of replacements. */
  #defs = null;

  #value = null;

  #hasDefs = false;
  #hasValue = false;

  #queueItems;

  constructor(workspace, path, dirArg, dirValue) {
    console.log('##### DEFS AT %o', path);
    if (path.length !== 1) {
      throw new Error(`\`${DefsDirective.NAME}\` only allowed at top level.`);
    }

    this.#queueItems = [
      {
        value:    dirValue,
        complete: (v) => {
          this.#value = v;
          this.#hasValue = true;
        }
      },
      {
        value: dirArg,
        complete: (v) => {
          this.#defs = new Map(Object.entries(v));
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

    if (!(this.#hasDefs && this.#hasValue)) {
      return { action: 'again' };
    }

    return { action: 'resolve', value: this.#value };
  }

  /**
   * Gets the replacement for the given named definition.
   *
   * @param {string} name Definition name.
   * @returns {*} The replacement.
   * @throws {Error} Thrown if there is no such definition.
   */
  getDef(name) {
    const defs = this.#defs;
    const def  = defs ? defs.get(name) : null;

    if (!def) {
      throw new Error(`No definition for: ${name}`);
    }

    return def;
  }


  //
  // Static members
  //

  /** @override */
  static get NAME() {
    return '$defs';
  }

  /** @override */
  static get REQUIRES() {
    return Object.freeze([]);
  }
}
