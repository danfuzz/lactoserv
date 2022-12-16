// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';

import { BaseService } from '#x/BaseService';


/**
 * "Controller" for a single service.
 */
export class ServiceController {
  /** @type {BaseService} Actual service instance. */
  #service;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an insance.
   *
   * @param {BaseService} service Instance to control.
   */
  constructor(service) {
    this.#service = service;
    this.#logger  = service.logger;
  }

  /** @returns {ServiceConfig} Configuration which defined this instance. */
  get config() {
    return this.#service.config;
  }

  /** @returns {string} Service name. */
  get name() {
    return this.#service.name;
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
