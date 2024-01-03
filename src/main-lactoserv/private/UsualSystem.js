// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Warehouse } from '@this/app-framework';
import { BaseSystem } from '@this/app-util';

import { MainArgs } from '#p/MainArgs';
import { ThisModule } from '#p/ThisModule';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
export class UsualSystem extends BaseSystem {
  /** @type {MainArgs} Command-line arguments. */
  #args;

  /** @type {?Warehouse} Warehouse of parts. */
  #warehouse = null;

  /**
   * Constructs an instance.
   *
   * @param {MainArgs} args Command-line arguments.
   */
  constructor(args) {
    super(ThisModule.logger.system);

    this.#args = args;
  }

  /** @override */
  async _impl_init(forReload_unused) {
    return await this.#args.warehouseMaker.make();
  }

  /** @override */
  async _impl_start(forReload, initValue) {
    this.#warehouse = initValue;
    await this.#warehouse.start(forReload);
  }

  /** @override */
  async _impl_stop(forReload, initValue_unused) {
    await this.#warehouse.stop(forReload);
    this.#warehouse = null;
  }
}
