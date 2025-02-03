// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { IntfLogger } from '@this/loggy-intf';
import { BaseConfig } from '@this/structy';
import { AskIf, MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';
import { Names } from '#x/Names';
import { RootControlContext } from '#x/RootControlContext';
import { ThisModule } from '#p/ThisModule';


/**
 * Abstract base class for controllable components which live in a tree-ish
 * hierarchical arrangement with other such components. Beyond just that, this
 * class defines a standardized configuration mechanism.
 *
 * **Note:** If a concrete subclass uses a configuration object with a `name`
 * property, then this class requires that that name honor the contract of
 * {@link Names#mustBeName}.
 */
export class BaseComponent {
  /**
   * Configuration for this component, or `null` if it does not have one.
   *
   * @type {?BaseConfig}
   */
  #config;

  /**
   * Associated context, if known, or a special "nascent" object to handle setup
   * that can happen before the instance is considered initialized. If `null` or
   * nascent, this will get set to an actual {@link ControlContext} instance
   * during {@link #init}.
   *
   * @type {?ControlContext|BaseComponent.NascentContext}
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
   * will attempt to construct the concrete class's defined
   * {@link #configClass}, and then set that as the final {@link #config}. When
   * doing so, the constructor is passed the given `rawConfig` augmented with
   * the additional binding of `class` to the concrete class being constructed
   * (that is, the concrete subclass of this class whose constructor call landed
   * here). See {@link BaseConfig#eval} for more details.
   *
   * @param {?object} [rawConfig] "Raw" (not guaranteed to be parsed and
   *   correct) configuration for this instance. It must either be an instance
   *   of the concrete class's {@link #configClass}, or a plain object which is
   *   acceptable to the constructor of that class, or `null` (equivalent to
   *   `{}`, that is, an empty object) to have no configuration properties.
   *   Default `null`.
   * @param {?RootControlContext} [rootContext] Associated context if this
   *   instance is to be the root of its control hierarchy, or `null` for any
   *   other instance.
   */
  constructor(rawConfig = null, rootContext = null) {
    const targetClass = new.target;
    this.#config = targetClass.configClass.eval(rawConfig, { targetClass });

    const name = this.#config?.name;
    if (name) {
      Names.mustBeName(name);
    }

    if (rootContext !== null) {
      // Note: We wrap `#context` here, so that it is recognized as
      // "uninitialized" by the time `start()` gets called.
      this.#context = new BaseComponent.#NascentContext(rootContext);
      rootContext[ThisModule.SYM_linkRoot](this);
    }
  }

  /**
   * @returns {?BaseConfig} Configuration object for this instance, or `null` if
   * it has no associated configuration. If non-`null`, this is an instance of
   * {@link #configClass}.
   */
  get config() {
    return this.#config;
  }

  /**
   * @returns {?ControlContext} Associated context, or `null` if not yet set up.
   */
  get context() {
    return (this.#contextReady ? this.#context : this.#context?.rootContext) ?? null;
  }

  /**
   * @returns {Array<function(new:object)>} Array of interface classes that this
   * class claims to implement. Always a frozen object.
   */
  get implementedInterfaces() {
    if (this.#implementedInterfaces === null) {
      const ifaces = this._impl_implementedInterfaces();

      MustBe.arrayOf(ifaces, AskIf.constructorFunction);
      Object.freeze(ifaces);

      this.#implementedInterfaces = ifaces;
    }

    return this.#implementedInterfaces;
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    return this.context?.logger ?? null;
  }

  /**
   * @returns {?string} Component name, or `null` if this instance neither
   * directly has a name nor is attached to a hierarchy (thereby granting it a
   * synthetic name).
   */
  get name() {
    const name = this.#config?.name;

    if (name) {
      return name;
    }

    const path = this.namePath?.path;

    return path
      ? path[path.length - 1]
      : null;
  }

  /**
   * @returns {?PathKey} The absolute name-path of this instance, that is,
   * where it is located in the hierarchy from its root component, or `null` if
   * this instance is not currently attached to a hierarchy.
   */
  get namePath() {
    return this.context?.namePath ?? null;
  }

  /**
   * @returns {BaseComponent} The root component of the hierarchy that this
   * instance is in.
   */
  get root() {
    return this.context.root.associate;
  }

  /**
   * @returns {string} Current component state. One of:
   *
   * * `new` -- Not yet initialized, which also means not yet attached to a
   *   hierarchy.
   * * `stopped` -- Initialized but not running.
   * * `running` -- Currently running.
   */
  get state() {
    return this.#contextReady
      ? this.context.state
      : 'new';
  }

  /**
   * Gets an iterator of all the _direct_ children of this instance.
   *
   * @yields {BaseComponent} A direct child.
   */
  *children() {
    for (const ctx of this.context.children()) {
      yield ctx.associate;
    }
  }

  /**
   * Initializes this instance, indicating it is now linked to the given
   * context.
   *
   * @param {ControlContext} context Context that indicates this instance's
   *   active environment.
   */
  async init(context) {
    MustBe.instanceOf(context, ControlContext);

    if (this.#contextReady) {
      throw new Error('Already initialized.');
    } else if ((this.#context !== null) && (this.#context.rootContext !== context)) {
      throw new Error('Inconsistent context setup.');
    }

    const nascentChildren = this.#context?.children;

    this.#context = context;

    this.logger?.initializing();

    this.#context[ThisModule.SYM_setState]('initializing');
    await this._impl_init();
    if (this.state !== 'stopped') {
      throw new Error('`super._impl_init()` never called on base class.');
    }

    if (nascentChildren && (nascentChildren.length !== 0)) {
      this.logger?.addingChildren();
      await this._prot_addAll(nascentChildren);
    }

    this.logger?.initialized();
  }

  /**
   * Indicates whether this instance implements (or at least _claims_ to
   * implement) or is a subclass of all the given classes / interfaces.
   *
   * @param {...function(new:BaseComponent)} [classes] List of classes and/or
   *   interfaces which the result must be an instance of or implement
   *   (respectively).
   * @returns {boolean} `true` if this instance matches the given criteria, or
   *   `false` if not.
   */
  instanceOfAll(...classes) {
    MustBe.arrayOf(classes, AskIf.constructorFunction);

    if (classes.length === 0) {
      return true;
    }

    const ifaces = this.implementedInterfaces;

    for (const cls of classes) {
      if (!((this instanceof cls) || ifaces.includes(cls))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Starts this instance. This method async-returns once the instance has
   * started.
   *
   * It is only valid to call this after {@link #init} has been called, _except_
   * if this instance is the root, in which case this method will call
   * {@link #init} itself before doing the start-per-se. It is also only valid
   * to call this method if the instance is not already running.
   */
  async start() {
    if (!this.#contextReady) {
      const context = this.#context?.rootContext;
      if (!context) {
        throw new Error('No context was set up in constructor or `init()`.');
      }
      await this.init(context);
    } else if (this.state !== 'stopped') {
      throw new Error('Already running.');
    }

    this.logger?.starting();

    this.#context[ThisModule.SYM_setState]('starting');
    await this._impl_start();
    if (this.state !== 'running') {
      throw new Error('`super._impl_start()` never called on base class.');
    }

    this.logger?.started();
  }

  /**
   * Stops this this instance. This method async-returns when the instance is
   * fully stopped.
   *
   * It is only valid to call this method if it is already running.
   *
   * @param {boolean} [willReload] Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload = false) {
    MustBe.boolean(willReload);

    if (this.state !== 'running') {
      throw new Error('Not running.');
    }

    const fate = willReload ? 'willReload' : 'shutdown';

    this.logger?.stopping(fate);

    this.#context[ThisModule.SYM_setState]('stopping');
    await this._impl_stop(willReload);
    if (this.state !== 'stopped') {
      throw new Error('`super._impl_stop()` never called on base class.');
    }

    this.logger?.stopped(fate);
  }

  /**
   * Async-returns when this instance's {@link #state} becomes `stopped`. This
   * cannot be used when `state === 'new'`.
   */
  async whenStopped() {
    if (this.state === 'new') {
      throw new Error('Not initialized.');
    }

    await this.#context.whenState('stopped');
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
   * called, the {@link #context} will have been set. Subclasses should always
   * call through to `super` so that all the base classes get a chance to take
   * action.
   *
   * **Note:** It is not appropriate to take any overt external action in this
   * method (such as writing files to the filesystem or opening a network
   * connection) beyond "sensing" (e.g., reading a file).
   */
  async _impl_init() {
    this.#context[ThisModule.SYM_setState]('stopped');
  }

  /**
   * Subclass-specific implementation of {@link #start}. Subclasses should
   * always call through to `super` so that all the base classes get a chance to
   * take action.
   */
  async _impl_start() {
    this.#context[ThisModule.SYM_setState]('running');
  }

  /**
   * Subclass-specific implementation of {@link #stop}. Subclasses should always
   * call through to `super` so that all the base classes get a chance to take
   * action.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async _impl_stop(willReload) { // eslint-disable-line no-unused-vars
    this.#context[ThisModule.SYM_setState]('stopped');
  }

  /**
   * Adds any number of children to this instance. Arguments can be either
   * component instances or iterables (including arrays) which yield component
   * instances. If any of the children turn out to be invalid arguments, then
   * this method will throw an error and not add anything.
   *
   * **Note:** This is a protected method which is intended to only be called by
   * an instance to modify itself.
   *
   * @param {...BaseComponent|Array<BaseComponent>|object} children Components
   *   to add.
   */
  async _prot_addAll(...children) {
    for (const c of BaseComponent.#flattenForAdd(...children)) {
      await this.#addChild(c);
    }
  }

  /**
   * Adds a child to this instance.
   *
   * **Note:** This is a protected method which is intended to only be called by
   * an instance to modify itself.
   *
   * @param {BaseComponent} child Child component to add.
   */
  async _prot_addChild(child) {
    MustBe.instanceOf(child, BaseComponent);
    const arr = BaseComponent.#flattenForAdd(child);
    await this.#addChild(arr[0]);
  }

  /**
   * @returns {boolean} Indication of whether or not this instance's context is
   * ready for use.
   */
  get #contextReady() {
    return this.#context instanceof ControlContext;
  }

  /**
   * Underlying implementation of {@link #_prot_addAll} and
   * {@link #_prot_addChild}. Assumes it is given a valid argument.
   *
   * @param {BaseComponent} child Child component to add.
   */
  async #addChild(child) {
    if (!this.#contextReady) {
      this.#context ??= new BaseComponent.#NascentContext();
      this.#context.addChild(child);
      return;
    }

    await child.init(new ControlContext(child, this));

    if (this.state === 'running') {
      // Get the child running, so as to match the parent.
      await child.start();
    }
  }


  //
  // Static members
  //

  /**
   * Map from each subclass to its return value for {@link #configClass}, lazily
   * filled in.
   *
   * @type {Map<function(new:BaseComponent), function(new:BaseConfig)>}
   */
  static #configClassMap = new Map();

  /**
   * @returns {function(new:BaseConfig, object)} The expected configuration
   * class. for this class. Subclasses should not override this; instead they
   * should override {@link #_impl_configClass}.
   */
  static get configClass() {
    const already = BaseComponent.#configClassMap.get(this);

    if (already) {
      return already;
    }

    // We can't just call `this._impl_configClass()` because `this` might
    // inherit it, and if it does we only want to call the inherited method once
    // ever, for all subclasses.

    let result;
    if (Object.hasOwn(this, '_impl_configClass')) {
      result = this._impl_configClass();
      MustBe.subclassOf(result, BaseConfig);
    } else {
      const superCls = Reflect.getPrototypeOf(this);
      result = superCls.configClass;
    }

    BaseComponent.#configClassMap.set(this, result);
    return result;
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
   * * Plain objects and instances of this class's {@link #configClass} are used
   *   to construct instances of this class, which then become result elements.
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
      } else if ((item instanceof this.configClass) || AskIf.plainObject(item)) {
        const { class: cls } = item;
        if (AskIf.constructorFunction(cls)) {
          if (AskIf.subclassOf(cls, this)) {
            return new cls(item);
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
   * Gets the expected configuration class for this class. This (base) class
   * calls this method exactly once to get the value to return from
   * {@link #configClass}.
   *
   * The default value is a configuration class which adds `name` as an optional
   * configuration property, on top of (optional) `class` as defined by
   * {@link #BaseConfig}.
   *
   * @returns {function(new:BaseConfig, object)} The expected configuration
   *   class.
   */
  static _impl_configClass() {
    return class Config extends BaseConfig {
      // @defaultConstructor

      /**
       * The item's name, or `null` if it does not have a configured name. If
       * `null`, the corresponding component will get a synthesized name as soon
       * as it is attached to a hierarchy. If non-`null`, it must adhere to the
       * syntax defined by {@link Names#mustBeName}. Names are used when finding
       * a component in its hierarchy, and when logging.
       *
       * @param {?string} [value] Proposed configuration value. Default `null`.
       * @returns {?string} Accepted configuration value.
       */
      _config_name(value = null) {
        return (value === null)
          ? null
          : Names.mustBeName(value);
      }
    };
  }

  /**
   * Helper for the various child-adding methods, which flattens the arguments
   * into a single array and does validity checking on the elements.
   *
   * @param {...BaseComponent|Array<BaseComponent>|object} children Components
   *   or iterables thereof.
   * @returns {Array<BaseComponent>} Array of validated components.
   */
  static #flattenForAdd(...children) {
    const result = [];

    for (const c of children) {
      if (c[Symbol.iterator]) {
        result.push(...c);
      } else {
        result.push(c);
      }
    }

    for (const c of result) {
      MustBe.instanceOf(c, BaseComponent);
      const ctx = c.#context;
      if (ctx) {
        if (ctx instanceof ControlContext) {
          if (ctx instanceof RootControlContext) {
            throw new Error('Cannot add root component to a different hierarchy.');
          } else {
            throw new Error('Cannot add initialized component to multiple hierarchies.');
          }
        } else if (ctx.hasParent) {
          throw new Error('Cannot add uninitialized component to multiple hierarchies.');
        }
      }
    }

    return result;
  }

  /**
   * Value for {@link #context} on an outer instance, for special cases that
   * need to store context-related data before the real context is set up.
   */
  static #NascentContext = class NascentContext {
    /**
     * Root context instance, or `null` if never set.
     *
     * @type {?RootControlContext}
     */
    #rootContext;

    /**
     * Children of the outer instance.
     *
     * @type {Array<BaseComponent>}
     */
    #children = [];

    /**
     * Does the outer instance have a parent?
     *
     * @type {boolean}
     */
    #hasParent = false;

    /**
     * Constructs an instance.
     *
     * @param {?RootControlContext} [rootContext] Root context if the outer
     *   instance is to be a root, or `null` if not.
     */
    constructor(rootContext = null) {
      this.#rootContext = (rootContext === null)
        ? null
        : MustBe.instanceOf(rootContext, RootControlContext);
    }

    /**
     * @returns {?RootControlContext} Root context instance to be used to
     * initialize the outer instance, or `null` if the outer instance is not
     * actually going to be a root.
     */
    get rootContext() {
      return this.#rootContext;
    }

    /** @returns {Array<BaseComponent>} Children of the outer instance. */
    get children() {
      return this.#children;
    }

    /** @returns {boolean} Does the outer instance have a parent? */
    get hasParent() {
      return this.#hasParent;
    }

    /**
     * Adds a child to this instance.
     *
     * @param {BaseComponent} child Component to add.
     */
    addChild(child) {
      child.#context ??= new NascentContext();
      child.#context.#hasParent = true;
      this.#children.push(child);
    }
  };
}
