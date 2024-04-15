// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Loggy } from '@this/loggy';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * Base logger for this module's subsystems, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
   */
  static #logger = Loggy.loggerFor('webapp');

  /**
   * @returns {?IntfLogger} Root logger for this module's component hierarchies,
   * or `null` not to do any logging.
   */
  static get logger() {
    return this.#logger;
  }
}
