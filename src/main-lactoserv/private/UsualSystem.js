// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Warehouse } from '@this/app-framework';
import { Condition, Threadlet } from '@this/async';
import { Host } from '@this/host';
import { IntfLogger } from '@this/loggy';

import { MainArgs } from '#p/MainArgs';
import { ThisModule } from '#p/ThisModule';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
export class UsualSystem extends Threadlet {
  /** @type {MainArgs} Command-line arguments. */
  #args;

  /** @type {boolean} Initialized? */
  #initDone = false;

  /** @type {Condition} Was a reload requested? */
  #reloadRequested = new Condition();

  /** @type {?Warehouse} Warehouse of parts. */
  #warehouse = null;

  /**
   * @type {?IntfLogger} Logger for this instance, or `null` not to do any
   * logging.
   */
  #logger = ThisModule.logger.system;

  /**
   * Constructs an instance.
   *
   * @param {MainArgs} args Command-line arguments.
   */
  constructor(args) {
    super(
      () => this.#start(),
      () => this.#run());

    this.#args = args;
  }

  /**
   * Performs pre-start initialization.
   */
  #init() {
    if (this.#initDone) {
      return;
    }

    Host.registerReloadCallback(() => this.#requestReload());
    Host.registerShutdownCallback(() => this.stop());

    this.#initDone = true;
  }

  /**
   * Helper for {@link #run}, which performs a system reload.
   */
  async #reload() {
    this.#logger.reloading();

    let nextWarehouse;

    try {
      nextWarehouse = await this.#args.warehouseMaker.make();
    } catch (e) {
      // Can't reload! There's an error in the config file.
      this.#logger.errorInReloadedConfig(e);
      this.#logger.notReloading();
      return;
    }

    await this.#stop(true);
    this.#warehouse = nextWarehouse;
    await this.#start(true);

    this.#logger.reloaded();
  }

  /**
   * Requests that the system be reloaded.
   */
  async #requestReload() {
    if (this.isRunning()) {
      this.#logger.reload('requested');
      this.#reloadRequested.value = true;
    } else {
      // Not actually running (probably in the middle of completely shutting
      // down).
      this.#logger.reload('ignoring');
    }
  }

  /**
   * Main thread body: Runs the system.
   */
  async #run() {
    if (this.#warehouse === null) {
      throw new Error('Shouldn\'t happen (no warehouse).');
    }

    while (!this.shouldStop()) {
      if (this.#reloadRequested.value === true) {
        await this.#reload();
        this.#reloadRequested.value = false;
      }

      await this.raceWhenStopRequested([
        this.#reloadRequested.whenTrue()
      ]);
    }

    await this.#stop();
  }

  /**
   * System start function. Used as the thread start function and also during
   * requested reloads.
   *
   * @param {boolean} [forReload = false] Is this for a reload?
   */
  async #start(forReload = false) {
    const logArg = forReload ? 'reload' : 'init';

    this.#init();

    this.#logger.starting(logArg);

    if (this.#warehouse === null) {
      try {
        this.#warehouse = await this.#args.warehouseMaker.make();
      } catch (e) {
        this.#logger.startAborted();
        throw e;
      }
    }

    await this.#warehouse.start(forReload);

    this.#logger.started(logArg);
  }

  /**
   * System stop function. Used when the system is shutting down on the way to
   * exiting, and also used during requested reloads.
   *
   * @param {boolean} [forReload = false] Is this for a reload?
   */
  async #stop(forReload = false) {
    const logArg = forReload ? 'willReload' : 'shutdown';

    this.#logger.stopping(logArg);
    await this.#warehouse.stop(forReload);
    this.#logger.stopped(logArg);

    this.#warehouse = null;
  }
}
