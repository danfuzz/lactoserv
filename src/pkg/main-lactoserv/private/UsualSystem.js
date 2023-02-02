// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers/promises';

import { Warehouse } from '@this/app-framework';
import { Condition, Threadlet } from '@this/async';
import { BuiltinApplications } from '@this/builtin-applications';
import { BuiltinServices } from '@this/builtin-services';
import { Host } from '@this/host';

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

  /** @type {Warehouse} Warehouse of parts. */
  #warehouse = null;

  /** @type {Error} Error to throw instead of running. */
  #error = null;

  /** @type {function(...*)} Logger for this instance. */
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

    BuiltinApplications.register();
    BuiltinServices.register();
    Host.registerReloadCallback(() => this.#reload());
    Host.registerShutdownCallback(() => this.stop());

    this.#initDone = true;
  }

  /**
   * Constructs (and possibly replaces) {@link #warehouse}.
   *
   * @param {boolean} forReload Is this for a reload?
   * @returns {boolean} `true` iff successful. `false` generally means there was
   * a configuration issue.
   */
  async #makeWarehouse(forReload) {
    const configUrl = this.#args.configUrl;
    let config;

    this.#warehouse = null;

    try {
      config = (await import(configUrl)).default;
    } catch (e) {
      this.#logger.configFileError(e);
      this.#error = e;
      return false;
    }

    try {
      this.#warehouse = new Warehouse(config, forReload);
    } catch (e) {
      this.#logger.warehouseConstructionError(e);
      this.#error = e;
      return false;
    }

    return true;
  }

  /**
   * Restarts the system.
   */
  async #reload() {
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
    if ((this.#error !== null) || (this.#warehouse === null)) {
      if (this.#warehouse === null) {
        this.#logger.noWarehouse();
      }

      if (this.#error === null) {
        this.#error = new Error('Configuration trouble.');
      }

      throw this.#error;
    }

    while (!this.shouldStop()) {
      if (this.#reloadRequested.value === true) {
        this.#logger.reloading();
        await this.#stop(true);
        await this.#start(true);
        this.#logger.reloaded();
        this.#reloadRequested.value = false;
      }

      await Promise.race([
        this.whenStopRequested(),
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

    const warehouseIsGood = await this.#makeWarehouse(forReload);

    if (!warehouseIsGood) {
      this.#logger.startAborted();
      return;
    }

    await this.#warehouse.startAllServices();
    await this.#warehouse.startAllServers();

    this.#logger.started(logArg);
  }

  /**
   * System stop function. Used when the system is shutting down on the way to
   * exiting, and also used during requested reloads.
   *
   * @param {boolean} [forReload = false] Is this for a reload?
   */
  async #stop(forReload = false) {
    const logArg = forReload ? 'reload' : 'shutdown';

    this.#logger.stoppingServers(logArg);

    const serversStopped = this.#warehouse.stopAllServers();

    // Easy way to log when the servers stopped, without more complicated logic.
    (async () => {
      await serversStopped;
      this.#logger.serversStopped(logArg);
    })();

    await Promise.race([
      serversStopped,
      timers.setTimeout(UsualSystem.#SERVER_STOP_GRACE_PERIOD_MSEC)
    ]);

    this.#logger.stoppingServices(logArg);

    await Promise.all([
      serversStopped,
      this.#warehouse.stopAllServices()
    ]);

    this.#logger.servicesStopped(logArg);

    this.#warehouse = null;
    this.#logger.fullyStopped(logArg);
  }


  //
  // Static members
  //

  /**
   * @type {number} Grace period after asking to stop all servers before asking
   * services to shut down. (If the servers stop more promptly, then the system
   * will immediately move on to service shutdown.)
   */
  static #SERVER_STOP_GRACE_PERIOD_MSEC = 250;
}
