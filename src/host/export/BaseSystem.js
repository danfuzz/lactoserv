// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Condition, Threadlet } from '@this/async';
import { BaseComponent, BaseConfig, BaseWrappedHierarchy, RootControlContext }
  from '@this/compy';
import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';

import { CallbackList } from '#x/CallbackList';
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
   * List of registered callbacks.
   *
   * @type {Array<CallbackList.Callback>}
   */
  #callbacks = [];

  /**
   * Was a reload requested?
   *
   * @type {Condition}
   */
  #reloadRequested = new Condition();

  /**
   * Thing that prevents the system from exiting, and logs occasionally about
   * that fact. Set up in {@link #_impl_init}.
   *
   * @type {?KeepRunning}
   */
  #keepRunning = null;

  /**
   * The wrapped component hierarchy. Set up in {@link #_impl_init}.
   *
   * @type {BaseWrappedHierarchy}
   */
  #wrappedHierarchy = null;

  /**
   * Threadlet that runs this instance.
   *
   * @type {Threadlet}
   */
  #thread = new Threadlet((runnerAccess) => this.#runThread(runnerAccess));

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
    const makeHierarchy = (oldRoot) => this._impl_makeHierarchy(oldRoot);

    /**
     * Wee subclass to hook up `_impl_makeHierarchy()`.
     *
     * TODO: There's gotta be a better way to do this.
     */
    class SystemWrappedHierarchy extends BaseWrappedHierarchy {
      /** @override */
      async _impl_makeHierarchy(oldRoot) {
        return makeHierarchy(oldRoot);
      }

      static _impl_configClass() {
        return BaseConfig;
      }
    }

    this.#wrappedHierarchy = new SystemWrappedHierarchy({ name: 'hierarchy' });
    this.#keepRunning      = new KeepRunning({ name: 'keepRunning' });

    await Promise.all([
      this._prot_addChild(this.#keepRunning),
      this._prot_addChild(this.#wrappedHierarchy)
    ]);
  }

  /** @override */
  async _impl_start() {
    this.#callbacks.push(
      Host.registerReloadCallback(() => this.#requestReload()),
      Host.registerShutdownCallback(() => this.stop()));

    // Note: The thread runner is responsible for starting and stopping the
    // `wrappedHierarchy`.

    await Promise.all([
      this.#keepRunning.start(),
      this.#thread.start()
    ]);
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    for (const cb of this.#callbacks) {
      cb.unregister();
    }
    this.#callbacks = [];

    // Note: The thread runner is responsible for starting and stopping the
    // `wrappedHierarchy`.

    await Promise.all([
      this.#thread.stop(),
      this.#keepRunning.stop()
    ]);
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

    await this.#wrappedHierarchy.stop();
  }

  /**
   * System start function. Called when starting from scratch as well as when
   * reloading.
   */
  async #startOrReload() {
    if (this.#wrappedHierarchy.state !== 'running') {
      await this.#wrappedHierarchy.start();
      return;
    }

    try {
      await this.#wrappedHierarchy.prepareToRestart();
    } catch {
      // Ignore the error (the wrapper will have logged the problem), and just
      // let the not-yet-stopped existing system keep running.
      return;
    }

    await this.#wrappedHierarchy.restart();
  }
}
