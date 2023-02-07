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

  /** @type {function(...*)} Base logger for application instances. */
  static #baseApplicationLogger = Loggy.loggerFor('app');

  /** @type {function(...*)} Base logger for server instances. */
  static #baseServerLogger = Loggy.loggerFor('server');

  /** @type {function(...*)} Base logger for service instances. */
  static #baseServiceLogger = Loggy.loggerFor('service');

  /** @returns {function(...*)} Base logger for application instances. */
  static get baseApplicationLogger() {
    return this.#baseApplicationLogger;
  }

  /** @returns {function(...*)} Base logger for server instances. */
  static get baseServerLogger() {
    return this.#baseServerLogger;
  }

  /** @returns {function(...*)} Base logger for service instances. */
  static get baseServiceLogger() {
    return this.#baseServiceLogger;
  }

  /**
   * @returns {?IntfLogger} Logger for this module, or `null` not to do any
   * logging.
   */
  static get logger() {
    return this.#logger;
  }
}
