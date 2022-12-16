// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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
