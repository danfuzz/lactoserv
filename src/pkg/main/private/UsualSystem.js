// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { SignalHandler } from '#p/SignalHandler';
import { TopErrorHandler } from '#p/TopErrorHandler';

import { Warehouse } from '@this/app-servers';
import { JsonExpander } from '@this/json';
import { Dirs } from '@this/util-host';

import * as timers from 'node:timers/promises';

/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
export class UsualSystem {
  /** @type {boolean} Initialized? */
  #initDone = false;

  /** @type {string} Directory where the setup / configuration lives. */
  #setupDir;

  /** @type {Warehouse} Warehouse of parts. */
  #warehouse = null;

  /**
   * Constructs an instance.
   *
   * @param {string[]} args_unused Command-line arguments to parse and act upon.
   */
  constructor(args_unused) {
    this.#setupDir  = Dirs.basePath('etc/example-setup');
    this.#warehouse = null;
  }

  /**
   * Starts the system.
   */
  async start() {
    if (!this.#initDone) {
      this.#init();
    }

    await this.#makeWarehouse();

    console.log('\n### Starting all servers...\n');
    await this.#warehouse.startAllServers();
    console.log('\n### Started all servers.\n');
  }

  /**
   * Stops the system.
   */
  async stop() {
    console.log('\n### Stopping all servers...\n');
    await warehouse.stopAllServers();
    console.log('\n### Stopped all servers.\n');
  }

  /**
   * Performs boot-time initialization.
   */
  #init() {
    SignalHandler.init();
    TopErrorHandler.init();
  }

  /**
   * Constructs (and possibly replaces) {@link #warehouse}.
   */
  async #makeWarehouse() {
    const jx        = new JsonExpander(this.#setupDir);
    const config    = await jx.expandFileAsync('config/config.json');

    this.#warehouse = new Warehouse(config);
  }
}
