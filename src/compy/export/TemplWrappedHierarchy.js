// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods, MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Template component class which manages a "wrapped" component hierarchy, that
 * is, this class provides a way to deal with a _different_ component hierarchy
 * at arm's length.
 *
 * @param {string} className The name of the resulting class.
 * @param {function(new:*)} superclass The superclass to extend (inherit from).
 * @returns {function(new:*)} The instantiated template class.
 */
export const TemplWrappedHierarchy = (className, superclass) => {
  MustBe.constructorFunction(superclass);
  MustBe.string(className);

  return class WrappedHierarchy extends superclass {
    /**
     * Current root component being managed. This is a value which used to be in
     * {@link #nextRootComponent}.
     *
     * @type {?BaseComponent}
     */
    #rootComponent = null;

    /**
     * Next root component to manage. This is a return value from
     * {@link #_impl_makeHierarchy}.
     *
     * @type {?BaseComponent}
     */
    #nextRootComponent = null;

    // @defaultConstructor

    /**
     * Prepare for a restart. This calls {@link #_impl_makeHierarchy}, and keeps
     * its return value, ready for a call to {@link #_prot_restart}. The
     * concrete subclass is expected to call this when appropriate.
     */
    async _prot_prepareToRestart() {
      await this.#loadOrReload();
    }

    /**
     * Restarts the wrapped hierarchy. This is only valid to call after a
     * successful call to {@link #_prot_prepareToRestart}. The concrete subclass
     * is expected to call this when appropriate.
     */
    async _prot_restart() {
      await this.#startOrRestart();
    }

    /**
     * Constructs the component hierarchy which this instance is to manage.
     * Subclasses must override this method. Note that this is called both
     * during initial startup and when the system is to be reloaded. In the
     * latter case, it is called while the "senescent" system is still running,
     * and care must be taken not to disturb it.
     *
     * If this method throws, then a non-running system will prompty exit with
     * an error, or an already-running system will just keep using its old
     * component hierarchy.
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
      await this.#loadOrReload();
      await super._impl_init();
    }

    /** @override */
    async _impl_start() {
      await this.#startOrRestart();
      await super._impl_start();
    }

    /** @override */
    async _impl_stop(willReload_unused) {
      // We don't pass `willReload` here, because from the wrapped component's
      // perspective it's always getting shut down, not reloaded.
      await this.#rootComponent.stop(false);
      this.#rootComponent = null;

      await super._impl_stop();
    }

    /**
     * Loads or reloads the wrapped root.
     */
    async #loadOrReload() {
      const isReload = (this.#rootComponent !== null);

      if (isReload) {
        this.logger?.reloading();
      } else {
        this.logger?.starting();
      }

      try {
        this.#nextRootComponent = await this._impl_makeHierarchy(this.#rootComponent);
      } catch (e) {
        // Failed to make the root component! E.g. and probably most likely,
        // this was due to an error in the config file.
        if (isReload) {
          this.logger?.errorDuringReload(e);
          this.logger?.notReloading();
        } else {
          this.logger?.errorDuringLoad(e);
        }
        throw e;
      }

      if (isReload) {
        this.logger?.reloadContinuing();
      }
    }

    /**
     * Start the wrapped component for the first time, or stops the old one and
     * then starts the new one for a restart.
     */
    async #startOrRestart() {
      const isReload = (this.#rootComponent !== null);

      if (isReload) {
        this.logger?.stopping('forReload');
        await this.#rootComponent.stop(isReload);
        this.logger?.stopped('forReload');
        this.#rootComponent = null;
      }

      try {
        this.#rootComponent     = this.#nextRootComponent;
        this.#nextRootComponent = null;
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
  };
};
