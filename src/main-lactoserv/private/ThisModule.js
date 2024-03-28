// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Loggy } from '@this/loggy';
import { IntfLogger } from '@this/loggy-intf';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * Logger for this module, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
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
