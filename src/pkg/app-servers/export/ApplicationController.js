// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationItem } from '@this/app-config';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { BaseApplication } from '#x/BaseApplication';


/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /** @type {BaseApplication} Actual application instance. */
  #application;

  /**
   * Constructs an insance.
   *
   * @param {ApplicationItem} config Parsed configuration item.
   * @param {?function(...*)} logger Logger to use, if any.
   */
  constructor(config, logger) {
    this.#logger      = logger ? logger[config.name] : null;
    this.#application = ApplicationFactory.makeInstance(config, logger);

    this.#logger.constructed();
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get application() {
    return this.#application;
  }

  /** @returns {ApplicationItem} Configuration which defined this instance. */
  get config() {
    return this.#application.config;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#application.name;
  }
}
