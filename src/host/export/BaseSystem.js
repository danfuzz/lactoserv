// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Condition } from '@this/async';
import { BaseComponent, BaseRootComponent, TemplWrappedHierarchy,
  TemplThreadComponent }
  from '@this/compy';
import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';

import { CallbackList } from '#x/CallbackList';
import { Host } from '#x/Host';
import { KeepRunning } from '#x/KeepRunning';

/**
 * Superclass of this class, which consists of two template mixins on top of the
 * base class.
 *
 * @type {function(new:BaseRootComponent)}
 */
const superclass = TemplThreadComponent(
  'SystemThread',
  TemplWrappedHierarchy(
    'SystemWrappedHierarchy',
    BaseRootComponent));

/**
 * Base class to operate the top level of a system, in the usual fashion. This
 * takes care of coordinating initialization, running, and shutdown, leaving
 * implementation holes for a concrete subclass to take appropriate app-specific
 * action.
 */
export class BaseSystem extends superclass {
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
   * Constructs an instance.
   *
   * @param {?IntfLogger} logger The logger to use, if any.
   */
  constructor(logger) {
    super({ rootLogger: logger });
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
    await super._impl_init();

    this.#keepRunning = new KeepRunning({ name: 'keepRunning' });

    await this._prot_addChild(this.#keepRunning);
  }

  /** @override */
  async _impl_start() {
    this.#callbacks.push(
      Host.registerReloadCallback(() => this.#requestReload()),
      Host.registerShutdownCallback(() => this.stop()));

    await this.#keepRunning.start();
    await super._impl_start();
  }

  /** @override */
  async _impl_threadRun(runnerAccess) {
    while (!runnerAccess.shouldStop()) {
      if (this.#reloadRequested.value === true) {
        await this.#reload();
        this.#reloadRequested.value = false;
      }

      await runnerAccess.raceWhenStopRequested([
        this.#reloadRequested.whenTrue()
      ]);
    }

    // We're stopping.

    await this.#keepRunning.stop();

    for (const cb of this.#callbacks) {
      cb.unregister();
    }
    this.#callbacks = [];
  }

  /**
   * Requests that the system be reloaded.
   */
  async #requestReload() {
    if (this.state === 'running') {
      this.logger?.reload('requested');
      this.#reloadRequested.value = true;
    } else {
      // Not actually running (probably in the middle of completely shutting
      // down).
      this.logger?.reload('ignoring');
    }
  }

  /**
   * Reloads / restarts the wrapped hierarchy.
   */
  async #reload() {
    try {
      await this._prot_prepareToRestart();
      await this._prot_restart();
    } catch {
      // Ignore the error (the wrapper will have logged the problem), and just
      // let the not-yet-stopped existing system keep running.
      return;
    }
  }
}
