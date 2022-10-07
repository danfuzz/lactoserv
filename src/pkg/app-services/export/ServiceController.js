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
    this.#name = serviceConfig.name;

    const extraConfig = { ...serviceConfig };
    delete extraConfig.name;
    delete extraConfig.type;

    this.#service = ServiceFactory.forType(serviceConfig.type, extraConfig);
    this.#logger  = logger[this.#name];
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


  //
  // Static members
  //

  /**
   * @returns {string} Regex pattern which matches an application name, anchored
   * so that it matches a complete string.
   *
   * This pattern allows non-empty strings consisting of alphanumerics plus `-`,
   * which furthermore must start and end with an alphanumeric character.
   */
  static get NAME_PATTERN() {
    const alnum = 'a-zA-Z0-9';

    return `^(?=[${alnum}])[-${alnum}]*[${alnum}]$`;
  }

  /**
   * @returns {string} Regex pattern which matches an application type, anchored
   * so that it matches a complete string. This is the same as
   * {@link #NAME_PATTERN}, the field name just being to help signal intent at
   * the use site.
   */
  static get TYPE_PATTERN() {
    return this.NAME_PATTERN;
  }
}
