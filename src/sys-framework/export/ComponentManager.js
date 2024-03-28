// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { ClassedConfig } from '@this/sys-config';
import { AskIf, MustBe } from '@this/typey';

import { BaseNamedComponent } from '#x/BaseNamedComponent';
import { BaseComponent } from '#x/BaseComponent';
import { ControlContext } from '#x/ControlContext';


/**
 * Manager for dealing with all the instantiable / instantiated components to be
 * run in a particular configuration.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the component instances.
 */
export class ComponentManager extends BaseComponent {
  /**
   * Base class of all components to be managed by this instance.
   *
   * @type {function(new:BaseNamedComponent)}
   */
  #baseClass;

  /**
   * Base class of all component configuration classes to be used by this
   * instance.
   *
   * @type {function(new:ClassedConfig)}
   */
  #configBaseClass;

  /**
   * Base sublogger to use for instantiated components, or `null` not to do any
   * logging.
   *
   * @type {?IntfLogger}
   */
  #baseSublogger;

  /**
   * Map from each bound name to the corresponding instance.
   *
   * @type {Map<string, BaseNamedComponent>}
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {Array<ClassedConfig>} configs Configuration objects.
   * @param {object} options Instantiation options.
   * @param {?function(new:BaseNamedComponent)} [options.baseClass] Base class
   *   of all components to be managed by this instance. `null` (the default) is
   *   the same as passing `BaseNamedComponent`.
   * @param {?IntfLogger} [options.baseSublogger] Base sublogger to use
   *   for instantiated components, or `null` not to do any logging.
   */
  constructor(configs, options) {
    const {
      baseClass = null,
      baseSublogger = null
    } = options;

    super();

    this.#baseClass = (baseClass === null)
      ? BaseNamedComponent
      : MustBe.subclassOf(baseClass, BaseNamedComponent);
    this.#configBaseClass = (baseClass === null)
      ? ClassedConfig
      : baseClass.CONFIG_CLASS;
    this.#baseSublogger = (baseSublogger === null)
      ? null
      : MustBe.instanceOf(baseSublogger, IntfLogger);

    MustBe.array(configs);
    for (const config of configs) {
      MustBe.instanceOf(config, this.#configBaseClass);
      MustBe.subclassOf(config.class, this.#baseClass);
      this.#addInstanceFor(config);
    }
  }

  /**
   * Gets the {@link BaseNamedComponent} instance bound to a given name.
   *
   * @param {string} name Instantiated component name to look for.
   * @param {?string|function(new:BaseNamedComponent)} [cls] Class that the named
   *   component must be an instance of, or `null` to not have any restriction
   *   (beyond the baseline class restriction of this instance).
   * @returns {BaseNamedComponent} The associated instance.
   * @throws {Error} Thrown if there is no instance with the given name, or it
   *   does not match the given `cls`.
   */
  get(name, cls = null) {
    const instance = this.#instances.get(name);

    if (!instance) {
      throw new Error(`No such component: ${name}`);
    }

    this.#checkInstanceClass(instance, cls);

    return instance;
  }

  /**
   * Gets a list of all component instances managed by this (manager) instance.
   *
   * @returns {Array<BaseNamedComponent>} All the instances.
   */
  getAll() {
    return [...this.#instances.values()];
  }

  /** @override */
  async _impl_init(isReload) {
    const instances = this.getAll();

    const results = instances.map((c) => {
      const logger  = this.#baseSublogger[c.name];
      const context = new ControlContext(c, this, logger);
      return c.init(context, isReload);
    });

    await Promise.all(results);
  }

  /** @override */
  async _impl_start(isReload) {
    const instances = this.getAll();
    const results   = instances.map((c) => c.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const instances = this.getAll();
    const results   = instances.map((c) => c.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Constructs a {@link BaseNamedComponent} based on the given information, and adds
   * a mapping to {@link #instances} so it can be found.
   *
   * @param {ClassedConfig} config Parsed configuration item.
   */
  #addInstanceFor(config) {
    MustBe.instanceOf(config, this.#configBaseClass);

    const name = config.name;

    if (this.#instances.has(name)) {
      throw new Error(`Duplicate component: ${name}`);
    }

    const instance = new config.class(config);
    this.#instances.set(name, instance);
  }

  /**
   * Checks that a {@link BaseNamedComponent} instance fits the given class
   * restriction.
   *
   * @param {BaseNamedComponent} component The instance to check.
   * @param {?function(new:BaseNamedComponent)} cls Class that `component` must be,
   *   or `null` to not have any restriction.
   * @throws {Error} Thrown if `component` is not an instance of an appropriate
   *   class.
   */
  #checkInstanceClass(component, cls) {
    if (cls === null) {
      // No restriction per se, but it had still better match this instance's
      // overall class restriction.
      cls = this.#baseClass;
    } else if (!AskIf.subclassOf(cls, this.#baseClass)) {
      throw new Error(`Not an appropriate component class: ${cls.name}, expected ${this.#baseClass.name}`);
    }

    if (!(component instanceof cls)) {
      throw new Error(`Wrong class for component: ${component.constructor.name}, expected ${cls.name}`);
    }
  }
}
