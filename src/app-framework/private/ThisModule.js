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
  static #logger = Loggy.loggerFor('framework');

  /**
   * @type {?IntfLogger} Base logger for server instances, or `null` not to do
   * any logging.
   */
  static #baseServerLogger = Loggy.loggerFor('server');

  /**
   * @returns {?IntfLogger} Base logger for server instances, or `null` not to
   * do any logging.
   */
  static get baseServerLogger() {
    return this.#baseServerLogger;
  }

  /**
   * @returns {?IntfLogger} Logger for this module, or `null` not to do any
   * logging.
   */
  static get logger() {
    return this.#logger;
  }
}
