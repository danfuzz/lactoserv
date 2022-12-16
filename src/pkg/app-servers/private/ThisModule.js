// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import { Loggy } from '@this/loggy';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /** @type {function(...*)} Logger for this module. */
  static #logger = Loggy.loggerFor('app-servers');

  /** @returns {function(...*)} Logger for this module. */
  static get logger() {
    return this.#logger;
  }
}
