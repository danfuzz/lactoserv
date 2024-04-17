// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { default as CONFIG } from './config-framework.mjs';

import { BaseSystem, Host } from '@this/host';
import { Loggy } from '@this/loggy';
import { WebappRoot } from '@this/webapp-core';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
class UsualSystem extends BaseSystem {
  /**
   * Constructs an instance.
   */
  constructor() {
    super(Loggy.loggerFor('main'));
  }

  /** @override */
  async _impl_makeHierarchy() {
    return new WebappRoot(CONFIG);
  }
}

Host.init();
Host.logToStdout();

const system = new UsualSystem();

await system.run();

// This `await` is not ever supposed to return.
await Host.exit();
throw new Error('Shouldn\'t happen.');
