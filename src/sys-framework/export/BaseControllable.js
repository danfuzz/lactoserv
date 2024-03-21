// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { Methods, MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';
import { RootControlContext } from '#x/RootControlContext';
import { ThisModule } from '#p/ThisModule';


/**
 * Base class for "controllable" things in the framework.
 *
 * TLDR: Concrete subclasses (a) have an associated context, and (b) have a set
 * of lifecycle methods.
 */
export class BaseControllable {
  /**
   * @type {?ControlContext|{ nascentRoot: RootControlContext }} Associated
   * context, if known, possibly wrapped in an object for the special case of
   * the root context before this instance is considered initialized. If `null`
   * or wrapped, will get set (to a proper instance) during {@link #init}.
   */
  #context = null;

  /**
   * Constructs an instance.
   *
   * @param {?RootControlContext} [rootContext] Associated context if this
   *   instance is to be the root of its control hierarchy, or `null` for any
   *   other instance.
   */
  constructor(context = null) {
    if (context !== null) {
      // Note: We wrap `#context` here, so that it is recognized as
      // "uninitialized" by the time `start()` gets called.
      this.#context = { nascentRoot: MustBe.instanceOf(context, RootControlContext) };
      context[ThisModule.SYM_linkRoot](this);
    }
  }

  /**
   * @returns {?ControlContext} Associated context, or `null` if not yet set up.
   */
  get context() {
    return (this.#initialized ? this.#context : this.#context?.nascentRoot) ?? null;
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    return this.context?.logger ?? null;
  }

  /**
   * Initializes this instance, indicating it is now linked to the given
   * context.
   *
   * @param {ControlContext} context Context that indicates this instance's
   *   active environment.
   * @param {boolean} [isReload] Is this action due to an in-process reload?
   */
  async init(context, isReload = false) {
    MustBe.instanceOf(context, ControlContext);
    MustBe.boolean(isReload);

    if (this.#initialized) {
      throw new Error('Already initialized.');
    } else if ((this.#context !== null) && (this.#context.nascentRoot !== context)) {
      throw new Error('Inconsistent context setup.');
    }

    this.#context = context;

    BaseControllable.logInitializing(this.logger);
    await this._impl_init(isReload);
    BaseControllable.logInitialized(this.logger);
  }

  /**
   * Starts this instance. It is only valid to call this after {@link #init} has
   * been called, _except_ if this instance is the root, in which case this
   * method will call {@link #init} itself before doing the start-per-se.
   *
   * @param {boolean} [isReload] Is this action due to an in-process reload?
   */
  async start(isReload = false) {
    MustBe.boolean(isReload);

    if (!this.#initialized) {
      if (this.#context === null) {
        throw new Error('No context was set up in constructor or `init()`.');
      }
      await this.init(this.#context.nascentRoot, isReload);
    }

    BaseControllable.logStarting(this.logger, isReload);
    await this._impl_start(isReload);
    BaseControllable.logStarted(this.logger, isReload);
  }

  /**
   * Stops this this instance. This method returns when the instance is fully
   * stopped.
   *
   * @param {boolean} [willReload] Is this action due to an in-process reload
   *   being requested?
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

  /** @returns {boolean} Whether or not this instance is initialized. */
  get #initialized() {
    return this.#context instanceof ControlContext;
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
