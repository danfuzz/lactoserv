// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { default as CONFIG } from './config.mjs';

import { BuiltinApplications } from '@this/builtin-applications';
import { BuiltinServices } from '@this/builtin-services';
import { Host, KeepRunning } from '@this/host';
import { Loggy } from '@this/loggy';
import { ComponentRegistry, Warehouse } from '@this/sys-framework';
import { BaseSystem } from '@this/sys-util';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
class UsualSystem extends BaseSystem {
  /** @type {?Warehouse} Warehouse of parts. */
  #warehouse = null;

  /**
   * Constructs an instance.
   */
  constructor() {
    super(Loggy.loggerFor('main'));
  }

  /** @override */
  async _impl_init(forReload_unused) {
    const classes = [
      ...BuiltinApplications.getAll(),
      ...BuiltinServices.getAll()
    ];
    const registry = new ComponentRegistry(classes);
    return new Warehouse(CONFIG, registry);
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
