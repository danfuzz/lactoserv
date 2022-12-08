// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Warehouse } from '@this/app-servers';
import { Condition, Threadlet } from '@this/async';
import { BuiltinApplications } from '@this/builtin-applications';
import { BuiltinServices } from '@this/builtin-services';
import { Host } from '@this/host';
import { Loggy } from '@this/loggy';

import { MainArgs } from '#p/MainArgs';


/**
 * A usual system, like, the normal setup for running this product in a
 * production-like way.
 */
export class UsualSystem extends Threadlet {
  /** @type {MainArgs} Command-line arguments. */
  #args;

  /** @type {boolean} Initialized? */
  #initDone = false;

  /** @type {Condition} Was a restart requested? */
  #restartRequested = new Condition();

  /** @type {Warehouse} Warehouse of parts. */
  #warehouse = null;

  /** @type {function(...*)} Logger for this instance. */
  #logger = Loggy.loggerFor('main').allServers;

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
    Host.registerReloadCallback(() => this.#restart());
    Host.registerShutdownCallback(() => this.stop());

    this.#initDone = true;
  }

  /**
   * Constructs (and possibly replaces) {@link #warehouse}.
   */
  async #makeWarehouse() {
    const configUrl = this.#args.configUrl;
    const config    = (await import(configUrl)).default;

    this.#warehouse = new Warehouse(config);
  }

  /**
   * Restarts the system.
   */
  async #restart() {
    if (this.isRunning()) {
      this.#logger.restart('requested');
      this.#restartRequested.value = true;
    } else {
      // Not actually running (probably in the middle of completely shutting
      // down).
      this.#logger.restart('ignoring');
    }
  }

  /**
   * Main thread body: Runs the system.
   */
  async #run() {
    while (!this.shouldStop()) {
      if (this.#restartRequested.value === true) {
        this.#logger.restarting();
        await this.#stop(true);
        await this.#start(true);
        this.#logger.restarted();
        this.#restartRequested.value = false;
      }

      await Promise.race([
        this.whenStopRequested(),
        this.#restartRequested.whenTrue()
      ]);
    }

    await this.#stop();
  }

  /**
   * System start function. Used as the thread start function and also during
   * requested restarts.
   *
   * @param {boolean} [forRestart = false] Is this for a restart?
   */
  async #start(forRestart = false) {
    const logArg = forRestart ? 'restart' : 'init';

    this.#init();

    this.#logger.starting(logArg);

    await this.#makeWarehouse();
    await this.#warehouse.startAllServices();
    await this.#warehouse.startAllServers();

    this.#logger.started(logArg);
  }

  /**
   * System stop function. Used when the system is shutting down on the way to
   * exiting, and also used during requested restarts.
   *
   * @param {boolean} [forRestart = false] Is this for a restart?
   */
  async #stop(forRestart = false) {
    const logArg = forRestart ? 'restart' : 'shutdown';

    this.#logger.stopping(logArg);

    await Promise.all([
      this.#warehouse.stopAllServers(),
      this.#warehouse.stopAllServices()
    ]);
    this.#warehouse = null;

    this.#logger.stopped(logArg);
  }
}
