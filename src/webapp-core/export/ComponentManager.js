// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent, BaseConfig, ControlContext } from '@this/compote';
import { IntfLogger } from '@this/loggy-intf';
import { AskIf, MustBe } from '@this/typey';


/**
 * Manager for dealing with a set of related (same general role) named
 * components.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the component instances.
 */
export class ComponentManager extends BaseComponent {
  /**
   * Base class of all components to be managed by this instance.
   *
   * @type {function(new:BaseComponent)}
   */
  #baseClass;

  /**
   * Map from each bound name to the corresponding instance.
   *
   * @type {Map<string, BaseComponent>}
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {Array<BaseComponent>} instances All the instances to manage.
   * @param {object} options Instantiation options.
   * @param {?function(new:BaseComponent)} [options.baseClass] Base class of all
   *   components to be managed by this instance. `null` (the default) is the
   *   same as passing `BaseComponent`.
   * @param {string} [options.name] Name of this instance, as a component.
   */
  constructor(instances, options) {
    const {
      baseClass = null,
      name
    } = options;

    super({ name });

    this.#baseClass = (baseClass === null)
      ? BaseComponent
      : MustBe.subclassOf(baseClass, BaseComponent);

    MustBe.array(instances);
    for (const instance of instances) {
      this.#addInstance(instance);
    }
  }

  /**
   * Gets the {@link BaseComponent} instance bound to a given name.
   *
   * @param {string} name Instantiated component name to look for.
   * @param {?string|function(new:BaseComponent)} [cls] Class that the named
   *   component must be an instance of, or `null` to not have any restriction
   *   (beyond the baseline class restriction of this instance).
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
   * @returns {Array<BaseComponent>} All the instances.
   */
  getAll() {
    return [...this.#instances.values()];
  }

  /** @override */
  async _impl_init(isReload) {
    const instances = this.getAll();

    const results = instances.map((c) => {
      const context = new ControlContext(c, this);
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
   * Validates the given instance, and adds it to {@link #instances}.
   *
   * @param {BaseComponent} instance Instance to add.
   */
  #addInstance(instance) {
    MustBe.instanceOf(instance, this.#baseClass);

    const name = instance.name;

    if (!name) {
      throw new Error('Component is missing `name`.');
    } else if (this.#instances.has(name)) {
      throw new Error(`Duplicate component: ${name}`);
    }

    this.#instances.set(name, instance);
  }

  /**
   * Checks that a {@link BaseComponent} instance fits the given class
   * restriction.
   *
   * @param {BaseComponent} component The instance to check.
   * @param {?function(new:BaseComponent)} cls Class that `component` must be,
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

  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return BaseConfig;
  }
}
