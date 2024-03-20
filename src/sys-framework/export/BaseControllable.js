// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { Methods, MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';


/**
 * Base class for "controllable" things in the framework.
 *
 * TLDR: Concrete subclasses (a) have an associated context, and (b) have a set
 * of lifecycle methods.
 */
export class BaseControllable {
  /** @type {boolean} Has {@link #_impl_init} been called? */
  #initialized = false;

  /**
   * @type {?ControlContext} Associated context. Becomes non-`null` during
   * {@link #init}.
   */
  #context = null;

  /**
   * Constructs an instance.
   *
   * @param {?ControlContext} [context] Associated context, or `null` to not
   *   start out with a context. This is typically `null` _except_ when creating
   *   the instance of this class which represents an entire "world" of
   *   controllable items.
   */
  constructor(context = null) {
    this.#context = (context === null)
      ? null
      : MustBe.instanceOf(context, ControlContext);
  }

  /**
   * @returns {?ControlContext} Associated context, or `null` if not yet set up.
   */
  get context() {
    return this.#context;
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    return this.#context?.logger;
  }

  /**
   * Initializes this instance, indicating it is now linked to the given
   * context.
   *
   * @param {ControlContext} context Context that indicates this instance's
   *   active environment.
   * @param {boolean} [isReload] Is this action due to an in-process
   *   reload?
   */
  async init(context, isReload = false) {
    MustBe.boolean(isReload);

    if (this.#initialized) {
      throw new Error('Already initialized.');
    } else if (this.#context === null) {
      this.#context = MustBe.instanceOf(context, ControlContext);
    }

    this.#initialized = true;

    BaseControllable.logInitializing(this.logger);
    await this._impl_init(isReload);
    BaseControllable.logInitialized(this.logger);
  }

  /**
   * Starts this instance.
   *
   * @param {boolean} [isReload] Is this action due to an in-process
   *   reload?
   */
  async start(isReload = false) {
    MustBe.boolean(isReload);

    if (!this.#initialized) {
      if (this.#context === null) {
        throw new Error('No associated context set up in constructor or `init()`.');
      }
      await this.init(null, isReload);
    }

    BaseControllable.logStarting(this.logger, isReload);
    await this._impl_start(isReload);
    BaseControllable.logStarted(this.logger, isReload);
  }

  /**
   * Stops this this instance. This method returns when the instance is fully
   * stopped.
   *
   * @param {boolean} [willReload] Is this action due to an in-process
   *   reload being requested?
   */
  async stop(willReload = false) {
    MustBe.boolean(willReload);

    BaseControllable.logStopping(this.logger, willReload);
    await this._impl_stop(willReload);
    BaseControllable.logStopped(this.logger, willReload);
  }

  /**
   * Subclass-specific implementation of {@link #init}. By the time this is
   * called, the {@link #context} will have been set.
   *
   * **Note:** It is not appropriate to take any overt external action in this
   * method (such as writing files to the filesystem or opening a network
   * connection) beyond "sensing" (e.g., reading a file).
   *
   * @abstract
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async _impl_init(isReload) {
    Methods.abstract(isReload);
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


  //
  // Static members
  //

  /**
   * Logs a message about an item (component, etc.) completing an `init()`
   * action.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   * @param {boolean} isReload Is this a system reload (vs. first-time init)?
   */
  static logInitialized(logger, isReload) {
    logger?.initialized(isReload ? 'reload' : 'boot');
  }

  /**
   * Logs a message about an item (component, etc.) starting an `init()`
   * action.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   * @param {boolean} isReload Is this a system reload (vs. first-time init)?
   */
  static logInitializing(logger, isReload) {
    logger?.initializing(isReload ? 'reload' : 'boot');
  }

  /**
   * Logs a message about an item (component, etc.) completing a `start()`
   * action.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   * @param {boolean} isReload Is this a system reload (vs. first-time init)?
   */
  static logStarted(logger, isReload) {
    logger?.started(isReload ? 'reload' : 'boot');
  }

  /**
   * Logs a message about an item (component, etc.) initiating a `start()`
   * action.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   * @param {boolean} isReload Is this a system reload (vs. first-time init)?
   */
  static logStarting(logger, isReload) {
    logger?.starting(isReload ? 'reload' : 'boot');
  }

  /**
   * Logs a message about an item (component, etc.) completing a `stop()`
   * action.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   * @param {boolean} willReload Is this a pending system reload (vs. final
   *   shutdown)?
   */
  static logStopped(logger, willReload) {
    logger?.stopped(willReload ? 'willReload' : 'shutdown');
  }

  /**
   * Logs a message about an item (component, etc.) initiating a `stop()`
   * action.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   * @param {boolean} willReload Is this a pending system reload (vs. final
   *   shutdown)?
   */
  static logStopping(logger, willReload) {
    logger?.stopping(willReload ? 'willReload' : 'shutdown');
  }
}
