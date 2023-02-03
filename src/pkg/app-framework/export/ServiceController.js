// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { BaseController } from '#x/BaseController';
import { BaseService } from '#x/BaseService';


/**
 * "Controller" for a single service.
 */
export class ServiceController extends BaseController {
  /** @type {BaseService} Actual service instance. */
  #service;

  /**
   * Constructs an insance.
   *
   * @param {BaseService} service Instance to control.
   */
  constructor(service) {
    MustBe.instanceOf(service, BaseService);
    super(service.config, service.logger);

    this.#service = service;
  }

  /** @returns {BaseService} The controlled service instance. */
  get service() {
    return this.#service;
  }

  /**
   * Starts the service.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   * @throws {Error} Thrown if there was trouble starting the service.
   */
  async start(isReload) {
    const logArgs = isReload ? ['reload'] : [];
    this.logger.starting(...logArgs);
    await this.#service.start(isReload);
    this.logger.started(...logArgs);
  }

  /**
   * Stops the service. This returns when the service is actually stopped.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   * @throws {Error} Thrown if there was trouble running or stopping the
   *   service.
   */
  async stop(willReload) {
    const logArgs = willReload ? ['reload'] : [];
    this.logger.stopping(...logArgs);
    await this.#service.stop(willReload);
    this.logger.stopped(...logArgs);
  }
}
