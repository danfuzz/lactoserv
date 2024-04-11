// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { AskIf, Methods, MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';
import { IntfComponent } from '#x/IntfComponent';
import { Names } from '#x/Names';
import { RootControlContext } from '#x/RootControlContext';
import { ThisModule } from '#p/ThisModule';


/**
 * Abstract base class which implements {@link IntfComponent}. This class also
 * handles the possibility of configuring instances using a configuration class;
 * configuration is part of this base class specifically (not exposed by {@link
 * IntfComponent}).
 *
 * **Note:** If a concrete subclass uses a configuration object with a `name`
 * property, then this class requires that that name honor the contract of
 * {@link Names#checkName}.
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
   * Value for {@link #implementedInterfaces}, or `null` if not yet calculated.
   *
   * @type {Array<function(new:object)>}
   */
  #implementedInterfaces = null;

  /**
   * Constructs an instance.
   *
   * After this constructor returns, it is safe for configuration-bearing
   * subclass instances to use {@link #config}, which will be a bona fide
   * configuration object for the instance at that point (not just a plain
   * object).
   *
   * **Note:** When passing `rawConfig` as a plain object, this constructor
   * will attempt to construct the concrete class's defined {@link
   * #CONFIG_CLASS}, and then set that as the final {@link #config}. When doing
   * so, the constructor is passed the given `rawConfig` augmented with the
   * additional binding of `class` to the concrete class being constructed (that
   * is, the concrete subclass of this class whose constructor call landed
   * here).
   *
   * @param {?object} [rawConfig] "Raw" (not guaranteed to be parsed and
   *   correct) configuration for this instance, or `null` if it has no
   *   associated configuration. If `null` then the class must define {@link
   *   #CONFIG_CLASS} as `null`. If non-`null`, then it must either be an
   *   instance of {@link #CONFIG_CLASS} _or_ must be a plain object which is
   *   acceptable to the constructor of {@link #CONFIG_CLASS}.
   * @param {?RootControlContext} [rootContext] Associated context if this
   *   instance is to be the root of its control hierarchy, or `null` for any
   *   other instance.
   */
  constructor(rawConfig = null, rootContext = null) {
    const configClass = this.constructor.CONFIG_CLASS;
    if (rawConfig === null) {
      if (configClass !== null) {
        throw new Error('Expected object argument for `rawConfig`.');
      }
      this.#config = null;
    } else if (configClass === null) {
      throw new Error('Expected `null` argument for `rawConfig`.');
    } else if (rawConfig instanceof configClass) {
      this.#config = rawConfig;
    } else if (AskIf.plainObject(rawConfig)) {
      const thisClass = this.constructor;
      const rawClass  = rawConfig.class;
      if (rawClass) {
        if (!AskIf.constructorFunction(rawClass)) {
          throw new Error('Expected class for `rawConfig.class`.');
        } else if (rawConfig.class !== thisClass) {
          throw new Error(`Mismatch on \`rawConfig.class\`: this ${thisClass.name}, got ${rawClass.name}`);
        }
      } else {
        rawConfig = { ...rawConfig, class: thisClass };
      }
      this.#config = new configClass(rawConfig);
    } else {
      throw new Error('Expected plain object or config instance for `rawConfig`.');
    }

    const name = this.#config?.name;
    if (name) {
      Names.checkName(name);
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
  get implementedInterfaces() {
    if (this.#implementedInterfaces === null) {
      const ifaces = this._impl_implementedInterfaces();

      MustBe.arrayOf(ifaces, AskIf.constructorFunction);
      Object.freeze(ifaces);

      this.#implementedInterfaces = ifaces;
    }

    return this.#implementedInterfaces;
  }

  /** @override */
  get logger() {
    return this.context?.logger ?? null;
  }

  /** @override */
  get name() {
    return this.#config?.name ?? null;
  }

  /** @override */
  get state() {
    return this.#initialized
      ? this.context.state
      : 'new';
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
    } else if (this.state !== 'stopped') {
      throw new Error('Already running.');
    }

    BaseComponent.logStarting(this.logger, isReload);
    await this._impl_start(isReload);
    this.#context[ThisModule.SYM_setState]('running');
    BaseComponent.logStarted(this.logger, isReload);
  }

  /** @override */
  async stop(willReload = false) {
    MustBe.boolean(willReload);

    if (this.state !== 'running') {
      throw new Error('Not running.');
    }

    BaseComponent.logStopping(this.logger, willReload);
    await this._impl_stop(willReload);
    this.#context[ThisModule.SYM_setState]('stopped');
    BaseComponent.logStopped(this.logger, willReload);
  }

  /**
   * @returns {Array<function(new:object)>} Array of interface classes that this
   * instance claims to implement. The base class calls this exactly once to get
   * the value to return from {@link #implementedInterfaces}. Defaults to `[]`.
   * Subclasses are expected to override this as necessary.
   */
  _impl_implementedInterfaces() {
    return [];
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
   * Map from each subclass to its return value for {@link #CONFIG_CLASS},
   * lazily filled in.
   *
   * @type {Map<function(new:BaseComponent),?function(new:object)>}
   */
  static #configClass = new Map();

  /**
   * @returns {?function(new:object, object)} The expected configuration class
   * for this class, or `null` if this class does not use a configuration class.
   * Defaults to `null`. Subclasses are expected to override this as necessary.
   */
  static get CONFIG_CLASS() {
    const already = BaseComponent.#configClass.get(this);

    if (already) {
      return already;
    }

    const configClass = this._impl_configClass();

    if (configClass !== null) {
      MustBe.constructorFunction(configClass);
    }

    BaseComponent.#configClass.set(this, configClass);

    return configClass;
  }

  /**
   * Evaluates a single value, or an array consisting of a heterogeneous mix of
   * values, producing an array of instances of this class (including
   * subclasses), where "this class" is the class that this method was called
   * on. (This _`static`_ method is implemented in the base class on behalf of
   * all subclasses.)
   *
   * The result array elements are derived as follows:
   *
   * * Instances of this class become result elements directly.
   * * Plain objects and instances of this class's {@link #CONFIG_CLASS} are
   *   used to construct instances of this class, which then become result
   *   elements.
   * * All other values are rejected, causing an `Error` to be `throw`n.
   *
   * @param {*} items Single instance or configuration, or array thereof.
   * @returns {Array<BaseComponent>} Frozen array of instances of the called
   *   class.
   * @throws {Error} Thrown if there was any trouble.
   */
  static evalArray(items) {
    if (items === null) {
      throw new Error('`items` must be non-null.');
    } else if (!Array.isArray(items)) {
      items = [items];
    }

    const result = items.map((item) => {
      if ((typeof item !== 'object') || (item === null)) {
        throw new Error('Item must be an object of some sort.');
      } else if (item instanceof this) {
        return item;
      } else if (item instanceof BaseComponent) {
        throw new Error('Item is not an instance of this class (or a subclass).');
      } else if ((item instanceof this.CONFIG_CLASS) || AskIf.plainObject(item)) {
        if (AskIf.constructorFunction(item.class)) {
          if (AskIf.subclassOf(item.class, this)) {
            return new (item.class)(item);
          } else {
            throw new Error('Item\'s `.class` is not this class (or a subclass).');
          }
        } else {
          return new this(item);
        }
      } else {
        throw new Error('Cannot construct component from item.');
      }
    });

    return Object.freeze(result);
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

  /**
   * @returns {?function(new:object, object)} The expected configuration class
   * for this class, or `null` if this class does not use a configuration class.
   * The base class calls this exactly once to get the value to return from
   * {@link #CONFIG_CLASS} Defaults to `null`. Subclasses are expected to
   * override this as necessary.
   */
  static _impl_configClass() {
    return null;
  }
}
