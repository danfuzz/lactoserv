// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { default as CONFIG } from './config-framework.mjs';

import { Host, KeepRunning } from '@this/host';
import { Loggy } from '@this/loggy';
import { Warehouse } from '@this/webapp-core';
import { BaseSystem } from '@this/webapp-util';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
class UsualSystem extends BaseSystem {
  /**
   * Warehouse of parts.
   *
   * @type {?Warehouse}
   */
  #warehouse = null;

  /**
   * Constructs an instance.
   */
  constructor() {
    super(Loggy.loggerFor('main'));
  }

  /** @override */
  async _impl_init(isReload_unused) {
    return new Warehouse(CONFIG);
  }

  /** @override */
  async _impl_start(isReload, initValue) {
    this.#warehouse = initValue;
    await this.#warehouse.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload, initValue_unused) {
    await this.#warehouse.stop(willReload);
    this.#warehouse = null;
  }
}

Host.init();
Host.logToStdout();

const system      = new UsualSystem();
const keepRunning = new KeepRunning();

keepRunning.run();
await system.run();
keepRunning.stop();

// This `await` is not ever supposed to return.
await Host.exit();
throw new Error('Shouldn\'t happen.');
