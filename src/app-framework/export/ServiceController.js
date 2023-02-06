// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { BaseController } from '#x/BaseController';
import { BaseService } from '#x/BaseService';
import { ThisModule } from '#p/ThisModule';


/**
 * "Controller" for a single service.
 */
export class ServiceController extends BaseController {
  /** @type {BaseService} Actual service instance. */
  #service;

  /**
   * Constructs an instance.
   *
   * @param {BaseService} service Instance to control.
   */
  constructor(service) {
    MustBe.instanceOf(service, BaseService);
    super(service.config, ThisModule.logger.service[service.name]);

    this.#service = service;
  }

  /** @returns {BaseService} The controlled service instance. */
  get service() {
    return this.#service;
  }

  /** @override */
  async _impl_start(isReload) {
    await this.#service.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#service.stop(willReload);
  }
}
