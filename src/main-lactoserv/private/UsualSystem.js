// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WebappRoot } from '@this/webapp-core';
import { BaseSystem } from '@this/webapp-util';

import { MainArgs } from '#p/MainArgs';
import { ThisModule } from '#p/ThisModule';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
export class UsualSystem extends BaseSystem {
  /**
   * Command-line arguments.
   *
   * @type {MainArgs}
   */
  #args;

  /**
   * Root component for the overall web application.
   *
   * @type {?WebappRoot}
   */
  #webapp = null;

  /**
   * Constructs an instance.
   *
   * @param {MainArgs} args Command-line arguments.
   */
  constructor(args) {
    super(ThisModule.logger?.system);

    this.#args = args;
  }

  /** @override */
  async _impl_init(isReload_unused) {
    return await this.#args.webappMaker.make();
  }

  /** @override */
  async _impl_start(isReload, initValue) {
    this.#webapp = initValue;
    await this.#webapp.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload, initValue_unused) {
    await this.#webapp.stop(willReload);
    this.#webapp = null;
  }
}
