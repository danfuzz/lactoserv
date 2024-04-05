// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseExposedThreadlet, Condition } from '@this/async';
import { Host, KeepRunning } from '@this/host';
import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';


/**
 * Base class to operate the top level of a system, in the usual fashion. This
 * takes care of coordinating initialization, running, and shutdown, leaving
 * implementation holes for a concrete subclass to take appropriate app-specific
 * action.
 */
export class BaseSystem extends BaseExposedThreadlet {
  /**
   * Initialized?
   *
   * @type {boolean}
   */
  #initDone = false;

  /**
   * Was a reload requested?
   *
   * @type {Condition}
   */
  #reloadRequested = new Condition();

  /**
   * Logger for this instance, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
   */
  #logger = null;

  /**
   * Thing that prevents the system from exiting, and logs occasionally about
   * that fact.
   *
   * @type {KeepRunning}
   */
  #keepRunning = new KeepRunning();

  /**
   * Value returned from {@link #_impl_init} which is currently being used.
   *
   * @type {*}
   */
  #initValue = null;

  /**
   * Value returned from {@link #_impl_init} which is to be used on the next
   * start (including a restart).
   *
   * @type {*}
   */
  #nextInitValue = null;

  /**
   * Constructs an instance.
   *
   * @param {?IntfLogger} logger The logger to use, if any.
   */
  constructor(logger) {
    super();

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
   * Helper for {@link #_impl_threadRun}, which performs a system reload.
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
   * System start function. Used as the thread start function and also during
   * requested reloads.
   *
   * @param {boolean} [isReload] Is the system being reloaded?
   */
  async #start(isReload = false) {
    const logArg = isReload ? 'reload' : 'init';

    this.#init();

    this.#logger?.starting(logArg);

    if (!isReload) {
      await this.#keepRunning.start();
      try {
        this.#nextInitValue = await this._impl_init(false);
      } catch (e) {
        this.#logger?.startAborted();
        throw e;
      }
    }

    this.#initValue     = this.#nextInitValue;
    this.#nextInitValue = null;
    await this._impl_start(isReload, this.#initValue);

    this.#logger?.started(logArg);
  }

  /**
   * System stop function. Used when the system is shutting down on the way to
   * exiting, and also used during requested reloads.
   *
   * @param {boolean} [willReload] Will the system be reloaded?
   */
  async #stop(willReload = false) {
    const logArg = willReload ? 'willReload' : 'shutdown';

    this.#logger?.stopping(logArg);
    await this._impl_stop(willReload, this.#initValue);
    this.#logger?.stopped(logArg);

    if (!willReload) {
      await this.#keepRunning.stop();
    }

    this.#initValue = null;
  }

  /**
   * Initializes any concrete-subclass-related bits, in preparation for running
   * the system. If `isReload` is passed as `true`, the system is _already_
   * running, and care should be taken not to disturb that. In particular, this
   * method is allowed to throw, and that will cause reloading to fail while
   * leaving the already-running system alone.
   *
   * @abstract
   * @param {boolean} isReload Is the system being reloaded?
   * @returns {*} Value to pass to {@link #_impl_start}, once it is time to
   *   (re-)start the system.
   */
  async _impl_init(isReload) {
    Methods.abstract(isReload);
  }

  /**
   * Starts the system, in a subclass-specific way.
   *
   * @param {boolean} isReload Is the system being reloaded?
   * @param {*} initValue Value previously returned from {@link #_impl_init}.
   */
  async _impl_start(isReload, initValue) {
    Methods.abstract(isReload, initValue);
  }

  /**
   * Stops the system, in a subclass-specific way.
   *
   * @param {boolean} [willReload] Will the system be reloaded?
   * @param {*} initValue Value previously returned from {@link #_impl_init}.
   */
  async _impl_stop(willReload, initValue) {
    Methods.abstract(willReload, initValue);
  }

  /** @override */
  async _impl_threadStart() {
    return this.#start();
  }

  /** @override */
  async _impl_threadRun(runnerAccess) {
    if (this.#initValue === null) {
      throw new Error('Shouldn\'t happen: No initialization value.');
    }

    while (!runnerAccess.shouldStop()) {
      if (this.#reloadRequested.value === true) {
        await this.#reload();
        this.#reloadRequested.value = false;
      }

      await runnerAccess.raceWhenStopRequested([
        this.#reloadRequested.whenTrue()
      ]);
    }

    await this.#stop();
  }
}
