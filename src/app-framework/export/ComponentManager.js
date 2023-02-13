// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ClassedConfig } from '@this/app-config';
import { IntfLogger } from '@this/loggy';
import { AskIf, MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';
import { BaseControllable } from '#x/BaseControllable';
import { ComponentRegistry } from '#x/ComponentRegistry';


/**
 * Manager for dealing with all the instantiable / instantiated components to be
 * run in a particular configuration.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the component instances.
 */
export class ComponentManager extends BaseControllable {
  /**
   * @type {function(new:BaseComponent)} Base class of all components to be
   * managed by this instance.
   */
  #baseClass;

  /**
   * @type {function(new:ClassedConfig)} Base class of all component
   * configuration classes to be used by this instance.
   */
  #configBaseClass;

  /**
   * @type {?IntfLogger} Base sublogger to use for instantiated components, or
   * `null` not to do any logging.
   */
  #baseSublogger;

  /** @type {ComponentRegistry} Registry of component classes. */
  #registry;

  /**
   * @type {Map<string, BaseComponent>} Map from each bound name to the
   * corresponding instance.
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {ClassedConfig[]} configs Configuration objects.
   * @param {object} options Instantiation options.
   * @param {?function(new:BaseComponent)} [options.baseClass = null] Base class
   *   of all components to be managed by this instance. `null` (the default) is
   *   the same as passing `BaseComponent`.
   * @param {?IntfLogger} [options.baseSublogger = null] Base sublogger to use
   *   for instantiated components, or `null` not to do any logging.
   * @param {?IntfLogger} [options.logger = null] Logger to use for this
   *   instance, or `null` not to do any logging.
   * @param {ComponentRegistry} options.registry Registry of component classes.
   */
  constructor(configs, options) {
    const {
      baseClass = null,
      baseSublogger = null,
      logger = null,
      registry
    } = options;

    super(logger);

    this.#baseClass = (baseClass === null)
      ? BaseComponent
      : MustBe.subclassOf(baseClass, BaseComponent);
    this.#configBaseClass = (baseClass === null)
      ? ClassedConfig
      : baseClass.CONFIG_CLASS;
    this.#baseSublogger = (baseSublogger === null)
      ? null
      : MustBe.instanceOf(IntfLogger, baseSublogger);
    this.#registry = MustBe.instanceOf(registry, ComponentRegistry);

    MustBe.array(configs);
    for (const config of configs) {
      MustBe.instanceOf(config, this.#configBaseClass);
      this.#addInstanceFor(config);
    }
  }

  /**
   * Gets the {@link BaseComponent} instance bound to a given name.
   *
   * @param {string} name Instantiated component name to look for.
   * @param {?string|function(new:BaseComponent)} cls Class or (string) class
   *   name that the named component must be an instance of, or `null` to not
   *   have any restriction.
   * @returns {BaseComponent} The associated instance.
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
   * @returns {BaseComponent[]} All the instances.
   */
  getAll() {
    return [...this.#instances.values()];
  }

  /** @override */
  async _impl_start(isReload) {
    const instances = this.getAll();
    const results   = instances.map((s) => s.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const instances = this.getAll();
    const results   = instances.map((s) => s.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Constructs a {@link BaseComponent} based on the given information, and adds
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

    const sublogger = this.#baseSublogger[name];
    const instance  = this.#registry.makeInstance(config, sublogger);

    MustBe.instanceOf(instance, this.#baseClass);

    this.#instances.set(name, instance);
    this.logger.bound(name);
  }

  /**
   * Checks that a {@link BaseComponent} instance fits the given class
   * restriction.
   *
   * @param {BaseComponent} component The instance to check.
   * @param {?string|function(new:BaseComponent)} cls Class or (string) class
   *   name that `component` must be, or `null` to not have any restriction.
   * @throws {Error} Thrown if `component` is not an instance of an appropriate
   *   class.
   */
  #checkInstanceClass(component, cls) {
    if (cls === null) {
      // No restriction per se, but it had still better match this instance's
      // overall class restriction.
      cls = this.#baseClass;
    } else if (typeof cls === 'string') {
      cls = this.#registry.get(cls, { class: this.#baseClass });
    } else if (!AskIf.subclassOf(cls, this.#baseClass)) {
      throw new Error(`Not an appropriate component class: ${cls.name}, expected ${this.#baseClass.name}`);
    }

    if (! (component instanceof cls)) {
      throw new Error(`Wrong class for component: ${component.constructor.name}, expected ${cls.name}`);
    }
  }
}
