// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Warehouse } from '@this/app-servers';
import { Mutex } from '@this/async';
import { JsonExpander } from '@this/json';
import { Dirs, Host } from '@this/host';
import { Loggy } from '@this/loggy';


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

  /** @type {function(...*)} Logger for this instance. */
  #logger = Loggy.loggerFor('main').allServers;

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
      const verb      = isRestart ? 'restart' : 'start';

      this.#logger[`${verb}ing`]();

      if (isRestart) {
        await this.#stop0();
      }

      await this.#makeWarehouse();
      await this.#warehouse.startAllServers();

      this.#logger[`${verb}ed`]();
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

    Host.registerReloadCallback(() => this.start());
    Host.registerShutdownCallback(() => this.stop());

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
      this.#logger.stop('ignoring');
    } else {
      this.#logger.stopping();
      this.#logger.allServers('stopping');
      await this.#warehouse.stopAllServers();
      this.#warehouse = null;
      this.#logger.stopped();
    }
  }
}
