// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Methods, MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for "controllable" things in the framework.
 *
 * TLDR: Concrete subclasses (a) have an associated (but optional) logger and
 * know how to `start()` and `stop()` themselves.
 */
export class BaseControllable {
  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Starts this instance.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async start(isReload) {
    MustBe.boolean(isReload);

    BaseComponent.logStarting(this.#logger, isReload);
    await this._impl_start(isReload);
    BaseComponent.logStarted(this.#logger, isReload);
  }

  /**
   * Stops this this instance. This method returns when the instance is fully
   * stopped.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload) {
    MustBe.boolean(willReload);

    BaseComponent.logStopping(this.#logger, willReload);
    await this._impl_stop(willReload);
    BaseComponent.logStopped(this.#logger, willReload);
  }

  /**
   * Subclass-specific implementation of {@link #start}.
   *
   * @abstract
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async _impl_start(isReload) {
    Methods.abstract(isReload);
  }

  /**
   * Subclass-specific implementation of {@link #stop}.
   *
   * @abstract
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async _impl_stop(willReload) {
    Methods.abstract(willReload);
  }
}
