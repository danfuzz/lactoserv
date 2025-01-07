// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Threadlet } from '@this/async';
import { TemplateUtil } from '@this/metacomp';
import { MustBe } from '@this/typey';


/**
 * Template class for components which want to have a thread-like
 * implementation: When the component is started or stopped, the
 * internally-defined thread is likewise started or stopped (respectively).
 *
 * @param {string} className The name of the resulting class.
 * @param {function(new:*)} superclass The superclass to extend (inherit from).
 * @returns {function(new:*)} The instantiated template class.
 */
export const TemplThreadComponent = (className, superclass) => {
  MustBe.constructorFunction(superclass);

  return TemplateUtil.make(className, class ThreadComponent extends superclass {
    /**
     * The threadlet which runs this instance.
     *
     * @type {Threadlet}
     */
    #threadlet = new Threadlet((runnerAccess) => this.#main(runnerAccess));

    // @defaultConstructor

    /** @override */
    async _impl_start() {
      await this.#threadlet.start();
      await super._impl_start();
    }

    /** @override */
    async _impl_stop(willReload) {
      await this.#threadlet.stop();
      await super._impl_stop(willReload);
    }

    /**
     * Tells the threadlet controlled by this instance to stop. Normally, it
     * will just stop when the component as a whole is stopped; this method
     * gives the subclass the ability to do it "off-cycle."
     */
    async _prot_threadStop() {
      await this.#threadlet.stop();
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
     * Threadlet main function.
     *
     * @param {Threadlet.RunnerAccess} runnerAccess The runner access instance.
     * @returns {*} Arbitrary result of running.
     * @throws {Error} Arbitrary error from running.
     */
    async #main(runnerAccess) {
      return this._impl_threadRun(runnerAccess);
    }
  });
};
