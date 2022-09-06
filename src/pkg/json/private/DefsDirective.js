// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

/**
 * Directive `$defs`, for defining a dictionary of replacements.
 */
export class DefsDirective extends JsonDirective {
  /** {Map<string, *>} Map of replacements. */
  #defs = null;

  // Note: The default constructor is fine here.

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

  /** @override */
  process(pass, path, value) {
    if (pass !== 1) {
      return value;
    }

    if (path.length === 1) {
      this.#defs = new Map(Object.entries(value));
      return undefined;
    } else {
      throw new Error('`$defs` only allowed at top level.');
    }
  }


  //
  // Static members
  //

  /** @override */
  static get NAME() {
    return '$defs';
  }
}
