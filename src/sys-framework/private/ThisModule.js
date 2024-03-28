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
   * Map of all loggers returned from {@link
   * #loggerFor}.
   *
   * @type {Map<string, IntfLogger>}
   */
  static #loggers = new Map();

  /**
   * Base logger for this module's subsystems, or `null` not
   * to do any logging.
   *
   * @type {?IntfLogger}
   */
  static #logger = Loggy.loggerFor('framework');

  /**
   * Symbol used for the module-private method `addDescendant`.
   *
   * @type {symbol}
   */
  static SYM_addDescendant = Symbol('sys-framework.addDescendant');

  /**
   * Symbol used for the module-private method `linkRoot`.
   *
   * @type {symbol}
   */
  static SYM_linkRoot = Symbol('sys-framework.linkRoot');

  /**
   * Gets a logger for a particular cohort. A "cohort" is a set of similar
   * items of some sort, e.g. "applications" or "services."
   *
   * @param {string} name Name of the cohort.
   * @returns {?IntfLogger} Logger for the cohort, or `null` if it is not to be
   *   logged.
   */
  static cohortLogger(name) {
    return this.#loggerFor(name, true);
  }

  /**
   * Gets a logger for a particular subsystem.
   *
   * @param {string} name Name of the subsystem or cohort.
   * @returns {?IntfLogger} Logger for the subsystem, or `null` if it is not to
   *   be logged.
   */
  static subsystemLogger(name) {
    return this.#loggerFor(name, false);
  }

  /**
   * Gets a logger for a particular subsystem or cohort. (A "cohort" is a set
   * of loggers for similar items, e.g. "applications" or "services.")
   *
   * @param {string} name Name of the subsystem or cohort.
   * @param {boolean} isCohort Is this a cohort?
   * @returns {?IntfLogger} Logger for the subsystem or cohort, or `null` if it
   *   is not to be logged.
   */
  static #loggerFor(name, isCohort) {
    MustBe.string(name);

    const mapKey  = `${name}-${isCohort}`;
    const already = this.#loggers.get(mapKey);

    if (already) {
      return already;
    }

    const result = isCohort
      ? Loggy.loggerFor(name)
      : this.#logger?.[name];

    this.#loggers.set(mapKey, result);

    return result;
  }
}
