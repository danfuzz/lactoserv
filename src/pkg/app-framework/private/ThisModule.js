// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Loggy } from '@this/loggy';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /** @type {function(...*)} General logger for this module. */
  static #logger = Loggy.loggerFor('fw');

  /** @type {function(...*)} Base logger for application instances. */
  static #baseApplicationLogger = Loggy.loggerFor('app');

  /** @type {function(...*)} Base logger for service instances. */
  static #baseServiceLogger = Loggy.loggerFor('service');

  /** @returns {function(...*)} Base logger for application instances. */
  static get baseApplicationLogger() {
    return this.#baseApplicationLogger;
  }

  /** @returns {function(...*)} Base logger for service instances. */
  static get baseServiceLogger() {
    return this.#baseServiceLogger;
  }

  /** @returns {function(...*)} General logger for this module. */
  static get logger() {
    return this.#logger;
  }
}
