// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseSystem } from '@this/host';

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
   * Constructs an instance.
   *
   * @param {MainArgs} args Command-line arguments.
   */
  constructor(args) {
    super(ThisModule.logger?.system);

    this.#args = args;
  }

  /** @override */
  async _impl_makeHierarchy() {
    return await this.#args.webappMaker.make();
  }
}
