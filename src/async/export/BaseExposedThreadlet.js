// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfThreadlike } from '#x/IntfThreadlike';
import { Threadlet } from '#x/Threadlet';


/**
 * Base class which implements {@link IntfThreadlike} by deferring to an
 * internally-managed {@link Threadlet} instance, whose run functions are
 * defined by the concrete subclass.
 *
 * @implements {IntfThreadlike}
 */
export class BaseExposedThreadlet {
  /**
   * The threadlet which runs this instance.
   *
   * @type {Threadlet}
   */
  #threadlet = new Threadlet(
    (runnerAccess) => this.#start(runnerAccess),
    () => this.#main());

  /**
   * The runner access instance, if known.
   *
   * @type {?Threadlet.RunnerAccess}
   */
  #runnerAccess = null;

  // @defaultConstructor

  /** @override */
  isRunning() {
    return this.#threadlet.isRunning();
  }

  /** @override */
  async run() {
    return this.#threadlet.run();
  }

  /** @override */
  async start() {
    return this.#threadlet.start();
  }

  /** @override */
  async stop() {
    return this.#threadlet.stop();
  }

  /** @override */
  async whenStarted() {
    return this.#threadlet.whenStarted();
  }

  /**
   * Runs subclass-specific start-time actions. This corresponds to the "start
   * function" described by {@link Threadlet}. Subclasses that wish to have
   * start actions must override this. By default it does nothing except return
   * `null`.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
   * @returns {*} Arbitrary result of starting.
   * @throws {Error} Arbitrary error from starting.
   */
  async _impl_start(runnerAccess) { // eslint-disable-line no-unused-vars
    return null;
  }

  /**
   * Runs the subclass-specific main thread action. This corresponds to the
   * "main function" described by {@link Threadlet}. Subclasses that wish to
   * have any main action must override this. By default it does nothing except
   * return `null`.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
   * @returns {*} Arbitrary result of starting.
   * @throws {Error} Arbitrary error from starting.
   */
  async _impl_main(runnerAccess) { // eslint-disable-line no-unused-vars
    return null;
  }

  /**
   * Gets the {@link Threadlet.RunnerAccess} instance associated with this
   * instance's {@link Threadlet}. This protected method is only supposed to be
   * used in this class's `_impl_*` methods.
   *
   * @returns {Threadlet.RunnerAccess} The runner access instance.
   */
  _prot_runnerAccess() {
    return this.#runnerAccess;
  }

  /**
   * Threadlet start function.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
   */
  async #start(runnerAccess) {
    this.#runnerAccess = runnerAccess;
    return this._impl_start(runnerAccess);
  }

  /**
   * Threadlet main function.
   */
  async #main() {
    return this._impl_main(this.#runnerAccess);
  }
}
