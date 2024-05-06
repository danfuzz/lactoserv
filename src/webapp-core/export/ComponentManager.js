// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent, TemplAggregateComponent } from '@this/compy';
import { MustBe } from '@this/typey';


/**
 * Manager for dealing with a set of related (same general role) named
 * components.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the component instances.
 */
export class ComponentManager extends TemplAggregateComponent('ComponentAggregate', BaseComponent) {
  /**
   * Base class of all components to be managed by this instance.
   *
   * @type {function(new:BaseComponent)}
   */
  #baseClass;

  /**
   * Constructs an instance.
   *
   * @param {object} options Instantiation options.
   * @param {?function(new:BaseComponent)} [options.baseClass] Base class of all
   *   components to be managed by this instance. `null` (the default) is the
   *   same as passing `BaseComponent`.
   * @param {string} [options.name] Name of this instance, as a component.
   */
  constructor(options) {
    const {
      baseClass = null,
      name
    } = options;

    super({ name });

    this.#baseClass = (baseClass === null)
      ? BaseComponent
      : MustBe.subclassOf(baseClass, BaseComponent);
  }

  /**
   * Gets the {@link BaseComponent} instance bound to a given name.
   *
   * @param {string} name Instantiated component name to look for.
   * @param {?function(new:*)} [cls] Class that the named component must be an
   *   instance of, or `null` to not have any restriction (beyond the baseline
   *   class restriction of this instance).
   * @returns {BaseComponent} The associated instance.
   * @throws {Error} Thrown if there is no instance with the given name, or it
   *   does not match the given `cls`.
   */
  get(name, cls = null) {
    const namePath = this.namePath.concat(name);
    const classes  = cls ? [cls] : [];

    return this.root.context.getComponent(namePath, ...classes);
  }

  /** @override */
  async _impl_start() {
    const instances = [...this.children()];
    const results   = instances.map((c) => c.start());

    await Promise.all(results);
    await super._impl_start();
  }

  /** @override */
  async _impl_stop(willReload) {
    const instances = [...this.children()];
    const results   = instances.map((c) => c.stop(willReload));

    await Promise.all(results);
    await super._impl_stop(willReload);
  }

  /** @override */
  _impl_isChildAllowed(child) {
    const baseClass = this.#baseClass;

    if (baseClass) {
      MustBe.instanceOf(child, this.#baseClass);
    }

    return true;
  }
}
