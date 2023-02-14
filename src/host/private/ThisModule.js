// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger, Loggy } from '@this/loggy';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * @type {?IntfLogger} Logger for this module, or `null` not to do any
   * logging.
   */
  static #logger = Loggy.loggerFor('host');

  /**
   * @returns {?IntfLogger} Logger for this module, or `null` not to do any
   * logging.
   */
  static get logger() {
    return this.#logger;
  }
}
