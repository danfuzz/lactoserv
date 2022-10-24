// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseService } from '#x/BaseService';
import { ServiceFactory } from '#x/ServiceFactory';


/**
 * "Controller" for a single service.
 */
export class ServiceController {
  /** @type {string} Service name. */
  #name;

  /** @type {object} Configuration for the underlying service. */
  #config;

  /** @type {BaseService} Actual service instance. */
  #service;

  /** @type {function(...*)} Instance-specific logger. */
  #logger;

  /**
   * Constructs an insance.
   *
   * @param {object} serviceConfig Service information configuration item.
   * @param {function(...*)} logger Logger to use.
   */
  constructor(serviceConfig, logger) {
    const { name, type } = serviceConfig;

    const config = { ...serviceConfig };
    delete config.name;
    delete config.type;
    Object.freeze(config);

    this.#name    = name;
    this.#config  = config;
    this.#service = ServiceFactory.forType(type, this);
    this.#logger  = logger[this.#name];
  }

  /** @returns {object} Configuration for the underlying service. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Service name. */
  get name() {
    return this.#name;
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
