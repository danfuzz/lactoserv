// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { IntfLogger, Loggy } from '@this/loggy';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * @type {?IntfLogger} Logger for this module, or `null` not to do any
   * logging.
   */
  static #logger = Loggy.loggerFor('main');

  /**
   * @returns {?IntfLogger} Logger for this module, or `null` not to do any
   * logging.
   */
  static get logger() {
    return this.#logger;
  }
}
