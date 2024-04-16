// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { default as CONFIG } from './config-framework.mjs';

import { Host, KeepRunning } from '@this/host';
import { Loggy } from '@this/loggy';
import { WebappRoot } from '@this/webapp-core';
import { BaseSystem } from '@this/webapp-util';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
class UsualSystem extends BaseSystem {
  /**
   * The web application, or `null` if not yet constructed.
   *
   * @type {?WebappRoot}
   */
  #webapp = null;

  /**
   * Constructs an instance.
   */
  constructor() {
    super(Loggy.loggerFor('main'));
  }

  /** @override */
  async _impl_init(isReload_unused) {
    return new WebappRoot(CONFIG);
  }

  /** @override */
  async _impl_start(initValue) {
    this.#webapp = initValue;
    await this.#webapp.start();
  }

  /** @override */
  async _impl_stop(willReload, initValue_unused) {
    await this.#webapp.stop(willReload);
    this.#webapp = null;
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
