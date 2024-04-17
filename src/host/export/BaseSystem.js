// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Condition, Threadlet } from '@this/async';
import { BaseComponent, RootControlContext } from '@this/compy';
import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';

import { Host } from '#x/Host';
import { KeepRunning } from '#x/KeepRunning';


/**
 * Base class to operate the top level of a system, in the usual fashion. This
 * takes care of coordinating initialization, running, and shutdown, leaving
 * implementation holes for a concrete subclass to take appropriate app-specific
 * action.
 */
export class BaseSystem extends BaseComponent {
  /**
   * Was a reload requested?
   *
   * @type {Condition}
   */
  #reloadRequested = new Condition();

  /**
   * Thing that prevents the system from exiting, and logs occasionally about
   * that fact.
   *
   * @type {KeepRunning}
   */
  #keepRunning = new KeepRunning();

  /**
   * Threadlet that runs this instance.
   *
   * @type {Threadlet}
   */
  #thread = new Threadlet((runnerAccess) => this.#runThread(runnerAccess));

  /**
   * Current root component being managed. This is a return value from
   * {@link #_impl_makeHierarchy}.
   *
   * @type {BaseComponent}
   */
  #rootComponent = null;

  /**
   * Constructs an instance.
   *
   * @param {?IntfLogger} logger The logger to use, if any.
   */
  constructor(logger) {
    super(null, new RootControlContext(logger));
  }

  /**
   * Runs the system. This async-returns once the system has shut down (either
   * by request or because of an uncaught error).
   */
  async run() {
    await this.start();
    await this.whenStopped();
  }

  /**
   * Constructs the component hierarchy which this instance is to manage.
   * Subclasses must override this method. Note that this is called both during
   * initial startup and when the system is to be reloaded. In the latter case,
   * it is called while the "senescent" system is still running, and care must
   * be taken not to disturb it.
   *
   * If this method throws, then a non-running system will prompty exit with an
   * error, or an already-running system will just keep using its old component
   * hierarchy.
   *
   * @abstract
   * @param {?BaseComponent} oldRoot The root of the currently-running system,
   *   if indeed the system is currently running, or `null` if this is a fresh
   *   system start.
   * @returns {BaseComponent} The root for the new system to run.
   */
  async _impl_makeHierarchy(oldRoot) {
    Methods.abstract(oldRoot);
  }

  /** @override */
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
    Host.registerReloadCallback(() => this.#requestReload());
    Host.registerShutdownCallback(() => this.stop());

    await this.#keepRunning.start();
    await this.#thread.start();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.#thread.stop();
    await this.#keepRunning.stop();
  }

  /**
   * Requests that the system be reloaded.
   */
  async #requestReload() {
    if (this.#thread.isRunning()) {
      this.logger?.reload('requested');
      this.#reloadRequested.value = true;
    } else {
      // Not actually running (probably in the middle of completely shutting
      // down).
      this.logger?.reload('ignoring');
    }
  }

  /**
   * Main action of this instance, which just starts the system, and then
   * reloads whenever requested, and then shuts down also when requested.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
   */
  async #runThread(runnerAccess) {
    await this.#startOrReload();

    while (!runnerAccess.shouldStop()) {
      if (this.#reloadRequested.value === true) {
        await this.#startOrReload();
        this.#reloadRequested.value = false;
      }

      await runnerAccess.raceWhenStopRequested([
        this.#reloadRequested.whenTrue()
      ]);
    }

    await this.#stop();
  }

  /**
   * System start function. Called when starting from scratch as well as when
   * reloading.
   */
  async #startOrReload() {
    const isReload = (this.#rootComponent !== null);

    if (isReload) {
      this.logger?.reloading();
    } else {
      this.logger?.starting();
    }

    let nextRoot;

    try {
      nextRoot = await this._impl_makeHierarchy(this.#rootComponent);
    } catch (e) {
      // Failed to make the root component! E.g. and probably most likely, this
      // was due to an error in the config file.
      if (isReload) {
        this.logger?.errorDuringReload(e);
        this.logger?.notReloading();
      } else {
        this.logger?.errorDuringLoad(e);
      }
      return;
    }

    if (isReload) {
      await this.#stop(true);
      this.logger?.reloadContinuing();
    }

    try {
      this.#rootComponent = nextRoot;
      await this.#rootComponent.start();
    } catch (e) {
      // There's no reasonable way to recover from a failed start, so just log
      // and then throw (which will probably cause the process to exit
      // entirely).
      this.logger?.errorDuringStart(e);
      throw e;
    }

    if (isReload) {
      this.logger?.reloaded();
    } else {
      this.logger?.started();
    }
  }

  /**
   * System stop function. Used when the system is shutting down on the way to
   * exiting, and also used during requested reloads.
   *
   * @param {boolean} [willReload] Will the system be reloaded?
   */
  async #stop(willReload = false) {
    const logArg = willReload ? 'forReload' : 'shutdown';

    this.logger?.stopping(logArg);
    await this.#rootComponent.stop(willReload);
    this.logger?.stopped(logArg);

    this.#rootComponent = null;
  }
}
