// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConfig } from '@this/app-config';
import { Methods, MustBe } from '@this/typey';


/**
 * Base class for major "components" of the framework.
 */
export class BaseComponent {
  /** @type {BaseConfig} Configuration for this component. */
  #config;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {BaseConfig} config Configuration for this component.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    this.#config = MustBe.instanceOf(config, BaseConfig);
    this.#logger = logger;
  }

  /** @returns {BaseConfig} Configuration for this instance. */
  get config() {
    return this.#config;
  }

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  get logger() {
    return this.#logger;
  }

  /** @returns {string} Component name. */
  get name() {
    return this.#config.name;
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:BaseConfig)} The configuration class for this
   * component.
   */
  static get CONFIG_CLASS() {
    return Methods.abstract();
  }

  /** @returns {string} The type name for this component. */
  static get TYPE() {
    return Methods.abstract();
  }

  /**
   * Logs a message about an item (component, controller, etc.) completing a
   * `start()` action.
   *
   * @param {?function(...*)} logger Logger to use, or `null` to not actually do
   *   any logging.
   * @param {boolean} isReload Is this a system reload (vs. first-time init)?
   */
  static logStarted(logger, isReload) {
    logger?.started(isReload ? 'reload' : 'init');
  }

  /**
   * Logs a message about an item (component, controller, etc.) initiating a
   * `start()` action.
   *
   * @param {?function(...*)} logger Logger to use, or `null` to not actually do
   *   any logging.
   * @param {boolean} isReload Is this a system reload (vs. first-time init)?
   */
  static logStarting(logger, isReload) {
    logger?.starting(isReload ? 'reload' : 'init');
  }

  /**
   * Logs a message about an item (component, controller, etc.) initiating a
   * `stop()` action.
   *
   * @param {?function(...*)} logger Logger to use, or `null` to not actually do
   *   any logging.
   * @param {boolean} willReload Is this a pending system reload (vs. final
   *   shutdown)?
   */
  static logStopping(logger, willReload) {
    logger?.stopping(willReload ? 'willReload' : 'shutdown');
  }

  /**
   * Logs a message about an item (component, controller, etc.) completing a
   * `stop()` action.
   *
   * @param {?function(...*)} logger Logger to use, or `null` to not actually do
   *   any logging.
   * @param {boolean} willReload Is this a pending system reload (vs. final
   *   shutdown)?
   */
  static logStopped(logger, willReload) {
    logger?.stopped(willReload ? 'willReload' : 'shutdown');
  }
}
