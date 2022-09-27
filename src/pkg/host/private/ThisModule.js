// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Logger } from '@this/see-all';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /** @type {Logger} Logger for this module. */
  static #logger = new Logger('host');

  /**
   * Logs an event with this module as the context.
   *
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   */
  static log(type, ...args) {
    this.#logger.log(type, ...args);
  }
}
