// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConfig } from '@this/app-config';
import { MustBe } from '@this/typey';


/**
 * Base class for "controllable" things in the framework.
 */
export class BaseController {
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

  /** @returns {BaseConfig} Configuration which defined this instance. */
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

  /** @returns {string} Server name. */
  get name() {
    return this.#config.name;
  }
}
