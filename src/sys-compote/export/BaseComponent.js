// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { AskIf, Methods, MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';
import { IntfComponent } from '#x/IntfComponent';
import { RootControlContext } from '#x/RootControlContext';
import { ThisModule } from '#p/ThisModule';


/**
 * Abstract base class which implements {@link IntfComponent}. This class also
 * handles the possibility of configuring instances using a configuration class;
 * configuration is part of this base class specifically (not exposed by {@link
 * IntfComponent}).
 *
 * @implements {IntfComponent}
 */
export class BaseComponent {
  /**
   * Configuration for this component, or `null` if it does not have one.
   *
   * @type {?object}
   */
  #config;

  /**
   * Associated context, if known, possibly wrapped in an object for the special
   * case of the root context before this instance is considered initialized. If
   * `null` or wrapped, will get set (to a proper instance) during {@link
   * #init}.
   *
   * @type {?ControlContext|{ nascentRoot: RootControlContext }}
   */
  #context = null;

  /**
   * Constructs an instance.
   *
   * @param {?object} [config] Configuration for this instance, or `null` if it
   *   has no associated configuration. If `null` then the class must define
   *   {@link #CONFIG_CLASS} as `null`. If non-`null`, then it must either be an
   *   instance of {@link #CONFIG_CLASS} _or_ must be a valid plain object value
   *   to pass to the constructor of {@link #CONFIG_CLASS}.
   * @param {?RootControlContext} [rootContext] Associated context if this
   *   instance is to be the root of its control hierarchy, or `null` for any
   *   other instance.
   */
  constructor(config = null, rootContext = null) {
    const configClass = this.constructor.CONFIG_CLASS;
    if (config === null) {
      if (configClass !== null) {
        throw new Error('Expected object argument for `config`.');
      }
      this.#config = null;
    } else if (configClass === null) {
      throw new Error('Expected `null` argument for `config`.');
    } else if (config instanceof configClass) {
      this.#config = config;
    } else if (AskIf.plainObject(config)) {
      this.#config = new configClass(config);
    } else {
      throw new Error('Expected plain object or config instance for `config`.');
    }

    if (rootContext !== null) {
      // Note: We wrap `#context` here, so that it is recognized as
      // "uninitialized" by the time `start()` gets called.
      this.#context = { nascentRoot: MustBe.instanceOf(rootContext, RootControlContext) };
      rootContext[ThisModule.SYM_linkRoot](this);
    }
  }

  /**
   * @returns {?object} Configuration object for this instance, or `null` if it
   * has no associated configuration. If non-`null`, this is an instance of
   * {@link #CONFIG_CLASS}.
   */
  get config() {
    return this.#config;
  }

  /** @override */
  get context() {
    return (this.#initialized ? this.#context : this.#context?.nascentRoot) ?? null;
  }

  /** @override */
  get logger() {
    return this.context?.logger ?? null;
  }

  /** @override */
  get name() {
    return null;
  }

  /** @override */
  async init(context, isReload = false) {
    MustBe.instanceOf(context, ControlContext);
    MustBe.boolean(isReload);

    if (this.#initialized) {
      throw new Error('Already initialized.');
    } else if ((this.#context !== null) && (this.#context.nascentRoot !== context)) {
      throw new Error('Inconsistent context setup.');
    }

    this.#context = context;

    BaseComponent.logInitializing(this.logger);
    await this._impl_init(isReload);
    BaseComponent.logInitialized(this.logger);
  }

  /** @override */
  async start(isReload = false) {
    MustBe.boolean(isReload);

    if (!this.#initialized) {
      if (this.#context === null) {
        throw new Error('No context was set up in constructor or `init()`.');
      }
      await this.init(this.#context.nascentRoot, isReload);
    }

    BaseComponent.logStarting(this.logger, isReload);
    await this._impl_start(isReload);
    BaseComponent.logStarted(this.logger, isReload);
  }

  /** @override */
  async stop(willReload = false) {
    MustBe.boolean(willReload);

    BaseComponent.logStopping(this.logger, willReload);
    await this._impl_stop(willReload);
    BaseComponent.logStopped(this.logger, willReload);
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
   * @returns {?function(new:object, object)} The expected configuration class
   * for this class, or `null` if this class does not use a configuration class.
   * Defaults to `null`. Subclasses are expected to override this as necessary.
   */
  static get CONFIG_CLASS() {
    return null;
  }

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
   * Logs a message about an item (component, etc.) starting an `init()` action.
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
