// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { SeeAll } from '@this/see-all';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /** @type {function(...*)} Logger for this module. */
  static #logger = SeeAll.loggerFor('host');

  /**
   * @returns {function(...*)} Logger for this module. */
  static get logger() {
    return this.#logger;
  }

  /**
   * Logs an event with this module as the context.
   *
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   */
  static log(type, ...args) {
    this.#logger(type, ...args);
  }
}
