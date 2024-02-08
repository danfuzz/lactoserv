// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Condition, Threadlet } from '@this/async';
import { Host } from '@this/host';
import { IntfLogger } from '@this/loggy';
import { Methods } from '@this/typey';


/**
 * Base class to operate the top level of a system, in the usual fashion. This
 * takes care of coordinating initialization, running, and shutdown, leaving
 * implementation holes for a concrete subclass to take appropriate app-specific
 * action.
 */
export class BaseSystem extends Threadlet {
  /** @type {boolean} Initialized? */
  #initDone = false;

  /** @type {Condition} Was a reload requested? */
  #reloadRequested = new Condition();

  /**
   * @type {?IntfLogger} Logger for this instance, or `null` not to do any
   * logging.
   */
  #logger = null;

  /**
   * @type {*} Value returned from {@link #_impl_init} which is currently being
   * used.
   */
  #initValue = null;

  /**
   * @type {*} Value returned from {@link #_impl_init} which is to be used on
   * the next start (including a restart).
   */
  #nextInitValue = null;

  /**
   * Constructs an instance.
   *
   * @param {?IntfLogger} logger The logger to use, if any.
   */
  constructor(logger) {
    super(
      () => this.#start(),
      () => this.#run());

    this.#logger = logger;
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
    this.#logger?.reloading();

    try {
      this.#nextInitValue = await this._impl_init(true);
    } catch (e) {
      // Can't reload! There's was a problem during re-initialization (e.g. an
      // error in the config file).
      this.#logger?.errorDuringReloaded(e);
      this.#logger?.notReloading();
      return;
    }

    await this.#stop(true);
    await this.#start(true);

    this.#logger?.reloaded();
  }

  /**
   * Requests that the system be reloaded.
   */
  async #requestReload() {
    if (this.isRunning()) {
      this.#logger?.reload('requested');
      this.#reloadRequested.value = true;
    } else {
      // Not actually running (probably in the middle of completely shutting
      // down).
      this.#logger?.reload('ignoring');
    }
  }

  /**
   * Main thread body: Runs the system.
   */
  async #run() {
    if (this.#initValue === null) {
      throw new Error('Shouldn\'t happen: No initialization value.');
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
   * @param {boolean} [forReload] Is this for a reload?
   */
  async #start(forReload = false) {
    const logArg = forReload ? 'reload' : 'init';

    this.#init();

    this.#logger?.starting(logArg);

    if (!forReload) {
      try {
        this.#nextInitValue = await this._impl_init(false);
      } catch (e) {
        this.#logger?.startAborted();
        throw e;
      }
    }

    this.#initValue     = this.#nextInitValue;
    this.#nextInitValue = null;
    await this._impl_start(forReload, this.#initValue);

    this.#logger?.started(logArg);
  }

  /**
   * System stop function. Used when the system is shutting down on the way to
   * exiting, and also used during requested reloads.
   *
   * @param {boolean} [forReload] Is this for a reload?
   */
  async #stop(forReload = false) {
    const logArg = forReload ? 'willReload' : 'shutdown';

    this.#logger?.stopping(logArg);
    await this._impl_stop(forReload, this.#initValue);
    this.#logger?.stopped(logArg);

    this.#initValue = null;
  }

  /**
   * Initializes any concrete-subclass-related bits, in preparation for running
   * the system. If `forReload` is passed as `true`, the system is _already_
   * running, and care should be taken not to disturb that. In particular, this
   * method is allowed to throw, and that will cause reloading to fail while
   * leaving the already-running system alone.
   *
   * @abstract
   * @param {boolean} forReload Is this for a reload?
   * @returns {*} Value to pass to {@link #_impl_start}, once it is time to
   *   (re-)start the system.
   */
  async _impl_init(forReload) {
    Methods.abstract(forReload);
  }

  /**
   * Starts the system, in a subclass-specific way.
   *
   * @param {boolean} forReload Is this for a reload?
   * @param {*} initValue Value previously returned from {@link #_impl_init}.
   */
  async _impl_start(forReload, initValue) {
    Methods.abstract(forReload, initValue);
  }

  /**
   * Stops the system, in a subclass-specific way.
   *
   * @param {boolean} forReload Is this for a reload?
   * @param {*} initValue Value previously returned from {@link #_impl_init}.
   */
  async _impl_stop(forReload, initValue) {
    Methods.abstract(forReload, initValue);
  }
}
