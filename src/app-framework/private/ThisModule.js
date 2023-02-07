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
   * @type {?IntfLogger} Base logger for application instances, or `null` not to
   * do any logging.
   */
  static #baseApplicationLogger = Loggy.loggerFor('app');

  /**
   * @type {?IntfLogger} Base logger for server instances, or `null` not to do
   * any logging.
   */
  static #baseServerLogger = Loggy.loggerFor('server');

  /**
   * @type {?IntfLogger} Base logger for service instances, or `null` not to do
   * any logging.
   */
  static #baseServiceLogger = Loggy.loggerFor('service');

  /**
   * @returns {?IntfLogger} Base logger for application instances, or `null` not
   * to do any logging.
   */
  static get baseApplicationLogger() {
    return this.#baseApplicationLogger;
  }

  /**
   * @returns {?IntfLogger} Base logger for server instances, or `null` not to
   * do any logging.
   */
  static get baseServerLogger() {
    return this.#baseServerLogger;
  }

  /**
   * @returns {?IntfLogger} Base logger for service instances, or `null` not to
   * do any logging.
   */
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
