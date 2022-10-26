// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceItem } from '@this/app-config';

import { BaseService } from '#x/BaseService';
import { ServiceFactory } from '#x/ServiceFactory';


/**
 * "Controller" for a single service.
 */
export class ServiceController {
  /** @type {ServiceItem} Configuration which defined this instance. */
  #config;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /** @type {BaseService} Actual service instance. */
  #service;

  /**
   * Constructs an insance.
   *
   * @param {ServiceItem} config Parsed configuration item.
   * @param {?function(...*)} logger Logger to use, if any.
   */
  constructor(config, logger) {
    this.#config  = config;
    this.#logger  = logger ? logger[config.name] : null;
    this.#service = ServiceFactory.makeInstance(config, logger);

    this.#logger?.constructed();
  }

  /** @returns {ServiceItem} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Service name. */
  get name() {
    return this.#config.name;
  }

  /** @returns {BaseService} The controlled service instance. */
  get service() {
    return this.#service;
  }

  /**
   * Starts the service.
   *
   * @throws {Error} Thrown if there was trouble starting the service.
   */
  async start() {
    this.#logger.starting();
    await this.#service.start();
    this.#logger.started();
  }

  /**
   * Stops the service. This returns when the service is actually stopped.
   *
   * @throws {Error} Thrown if there was trouble running or stopping the
   *   service.
   */
  async stop() {
    this.#logger.stopping();
    await this.#service.stop();
    this.#logger.stopped();
  }
}
