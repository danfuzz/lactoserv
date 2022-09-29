// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Loggy } from '@this/loggy';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /** @type {function(...*)} Logger for this module. */
  static #logger = Loggy.loggerFor('host');

  /** @returns {function(...*)} Logger for this module. */
  static get logger() {
    return this.#logger;
  }
}
