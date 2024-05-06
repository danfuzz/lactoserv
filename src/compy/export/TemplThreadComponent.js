// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Threadlet } from '@this/async';
import { MustBe } from '@this/typey';


/**
 * Template class for components which want to have a thread-like
 * implementation: When the component is started or stopped, the
 * internally-defined thread is likewise started or stopped (respectively).
 *
 * If a subclass overrides any of the `BaseComponent` `_impl_*` methods, it must
 * always call `super._impl_*`, in order for this class to operate correctly.
 * That said, it should usually be the case that subclasses only need to
 * implement {@link #_impl_threadStart} and {@link #_impl_threadRun}.
 *
 * @param {string} className The name of the resulting class.
 * @param {function(new:*)} superclass The superclass to extend (inherit from).
 * @returns {function(new:*)} The instantiated template class.
 */
export const TemplThreadComponent = (className, superclass) => {
  MustBe.constructorFunction(superclass);
  MustBe.string(className);

  return class ThreadComponent extends superclass {
    /**
     * The threadlet which runs this instance.
     *
     * @type {Threadlet}
     */
    #threadlet = new Threadlet(
      (runnerAccess) => this.#start(runnerAccess),
      (runnerAccess) => this.#main(runnerAccess));

    // @defaultConstructor

    /** @override */
    async _impl_start() {
      await this.#threadlet.start();
      await super._impl_start();
    }

    /** @override */
    async _impl_stop(willReload_unused) {
      await this.#threadlet.stop();
    }

    /**
     * Runs subclass-specific start-time actions. This corresponds to the "start
     * function" described by {@link Threadlet}. Subclasses that wish to have
     * start actions must override this. By default it does nothing except
     * return `null`.
     *
     * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
     * @returns {*} Arbitrary result of starting.
     * @throws {Error} Arbitrary error from starting.
     */
    async _impl_threadStart(runnerAccess) { // eslint-disable-line no-unused-vars
      return null;
    }

    /**
     * Runs the subclass-specific main thread action. This corresponds to the
     * "main function" described by {@link Threadlet}. Subclasses that wish to
     * have any main action must override this. By default it does nothing
     * except return `null`.
     *
     * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
     * @returns {*} Arbitrary result of running.
     * @throws {Error} Arbitrary error from running.
     */
    async _impl_threadRun(runnerAccess) { // eslint-disable-line no-unused-vars
      return null;
    }

    /**
     * Threadlet start function.
     *
     * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
     * @returns {*} Arbitrary result of starting.
     * @throws {Error} Arbitrary error from starting.
     */
    async #start(runnerAccess) {
      return this._impl_threadStart(runnerAccess);
    }

    /**
     * Threadlet main function.
     *
     * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
     * @returns {*} Arbitrary result of running.
     * @throws {Error} Arbitrary error from running.
     */
    async #main(runnerAccess) {
      return this._impl_threadRun(runnerAccess);
    }
  };
};
