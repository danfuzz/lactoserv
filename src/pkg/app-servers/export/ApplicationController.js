// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationItem } from '@this/app-config';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { BaseApplication } from '#x/BaseApplication';


/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /** @type {object} Configuration for the underlying application. */
  #config;

  /** @type {BaseApplication} Actual application instance. */
  #application;

  /**
   * Constructs an insance.
   *
   * @param {ApplicationItem} config Parsed configuration item.
   */
  constructor(config) {
    this.#config      = config;
    this.#application = ApplicationFactory.forType(config.type, config, this);
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get application() {
    return this.#application;
  }

  /** @returns {ApplicationItem} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#config.name;
  }
}
