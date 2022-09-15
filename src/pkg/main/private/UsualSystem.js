// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ShutdownHandler } from '#p/ShutdownHandler';
import { SignalHandler } from '#p/SignalHandler';

import { Warehouse } from '@this/app-servers';
import { Mutex } from '@this/async';
import { JsonExpander } from '@this/json';
import { Dirs } from '@this/util-host';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
export class UsualSystem {
  /** @type {string} Directory where the setup / configuration lives. */
  #setupDir;

  /** @type {boolean} Initialized? */
  #initDone = false;

  /** @type {Warehouse} Warehouse of parts. */
  #warehouse = null;

  /** @type {Mutex} Serializer for startup and shutdown actions. */
  #serializer = new Mutex();

  /**
   * Constructs an instance.
   *
   * @param {string[]} args_unused Command-line arguments to parse and act upon.
   */
  constructor(args_unused) {
    this.#setupDir = Dirs.basePath('etc/example-setup');
  }

  /**
   * Starts or restarts the system.
   */
  async start() {
    await this.#serializer.serialize(async () => {
      this.#init();

      const isRestart = (this.#warehouse !== null);
      const verb      = isRestart ? 'Restart' : 'Start';

      console.log(`\n### ${verb}ing all servers...\n`);

      if (isRestart) {
        await this.#stop0();
      }

      await this.#makeWarehouse();
      await this.#warehouse.startAllServers();

      console.log(`\n### ${verb}ed all servers.\n`);
    });
  }

  /**
   * Stops the system.
   */
  async stop() {
    await this.#serializer.serialize(() => this.#stop0());
  }

  /**
   * Performs boot-time initialization.
   */
  #init() {
    if (this.#initDone) {
      return;
    }

    SignalHandler.registerReloadCallback(() => this.start());
    ShutdownHandler.registerCallback(() => this.stop());

    this.#initDone = true;
  }

  /**
   * Constructs (and possibly replaces) {@link #warehouse}.
   */
  async #makeWarehouse() {
    const jx     = new JsonExpander(this.#setupDir);
    const config = await jx.expandFileAsync('config/config.json');

    this.#warehouse = new Warehouse(config);
  }

  /**
   * Helper for {@link #start} and {@link #stop}, which performs the main action
   * of stopping.
   */
  async #stop0() {
    if (this.#warehouse === null) {
      console.log('\n### Servers already stopped.\n');
    } else {
      console.log('\n### Stopping all servers...\n');
      await this.#warehouse.stopAllServers();
      this.#warehouse = null;
      console.log('\n### Stopped all servers.\n');
    }
  }
}
