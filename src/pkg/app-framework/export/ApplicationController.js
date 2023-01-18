// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';

import { BaseApplication } from '#x/BaseApplication';


/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /** @type {BaseApplication} Actual application instance. */
  #application;

  /**
   * Constructs an insance.
   *
   * @param {BaseApplication} application Instance to control.
   */
  constructor(application) {
    this.#application = application;
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get application() {
    return this.#application;
  }

  /** @returns {ApplicationConfig} Configuration which defined this instance. */
  get config() {
    return this.#application.config;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#application.name;
  }
}
