// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConfig } from '@this/app-config';
import { Methods, MustBe } from '@this/typey';


/**
 * Base class for "controllable" things in the framework.
 */
export class BaseController {
  /** @type {BaseConfig} Configuration for this component. */
  #config;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {BaseConfig} config Configuration for this component.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    this.#config = MustBe.instanceOf(config, BaseConfig);
    this.#logger = logger;
  }

  /** @returns {BaseConfig} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  get logger() {
    return this.#logger;
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#config.name;
  }

  /**
   * Starts this instance. In the case of instances which control a {@link
   * BaseComponent}, this in turn starts the component.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async start(isReload) {
    MustBe.boolean(isReload);
    await this._impl_start(isReload);
  }

  /**
   * Stops this this instance. In the case of instances which control a {@link
   * BaseComponent}, this in turn stops the component. This method returns when
   * the instance is fully stopped.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload) {
    MustBe.boolean(willReload);
    await this._impl_stop(willReload);
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
