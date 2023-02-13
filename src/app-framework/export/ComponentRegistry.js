// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ClassedConfig } from '@this/app-config';
import { MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Registry for component (application and service) classes.
 */
export class ComponentRegistry {
  /**
   * @type {Map<string, function(new:BaseComponent, ...*)>} Map from each
   * registerered class name to the concrete component class that implements it.
   */
  #classes = new Map();

  /**
   * Constructs an instance.
   *
   * @param {?(function(new:BaseComponent))[]} [classes = null] Initial classes
   *   to be registered.
   */
  constructor(classes = null) {
    if (classes !== null) {
      for (const c of classes) {
        this.register(c);
      }
    }
  }

  /**
   * Gets the class (or configuration class) for the component with the given
   * class name.
   *
   * @param {string} name Name of the component class.
   * @param {object} [options = null] Options for the search and result.
   * @param {?function((new:BaseComponent))} [options.class = null] Class
   *   (concrete or base) that the returned class must be or inherit from.
   * @param {boolean} [options.nullIfNotFound = false] Return `null` if there is
   *   no such class? If `false`, throws an error.
   * @param {boolean} [options.wantConfig = false] Return the _config_ class,
   *   instead of the implementation class?
   * @returns {?function((new:BaseComponent))} The component class, or `null` if
   *   not found (and `options.nullIfNotFound === true`).
   * @throws {Error} Thrown if there is no such class and
   *   `options.nullIfNotFound === false`.
   */
  get(name, options = null) {
    const {
      class: requiredClass = null,
      nullIfNotFound       = false,
      wantConfig           = false
    } = options ?? {};

    const found = this.#classes.get(name);

    if (!found) {
      if (nullIfNotFound) {
        return null;
      } else {
        throw new Error(`Unknown component class: ${name}`);
      }
    }

    if (requiredClass !== null) {
      if (!(found instanceof requiredClass.constructor)) {
        // That is, `found` is not a subclass of `requiredClass`.
        throw new Error(`Not an appropriate component class: ${name}, expected ${requiredClass.name}`);
      }
    }

    return wantConfig
      ? found.CONFIG_CLASS
      : found;
  }

  /**
   * Constructs an instance based on the given configuration.
   *
   * @param {ClassedConfig} config Configuration object.
   * @param {...*} rest Other construction arguments.
   * @returns {BaseComponent} Constructed instance.
   */
  makeInstance(config, ...rest) {
    const cls = this.get(config.class);
    return new cls(config, ...rest);
  }

  /**
   * Registers a component class.
   *
   * @param {function(new:BaseComponent, ...*)} cls Component class.
   * @param {?function((new:BaseComponent))} [baseClass = null] Base class that
   *   `cls` must be inherit from.
   */
  register(cls, baseClass = null) {
    MustBe.constructorFunction(cls);
    if (baseClass) MustBe.constructorFunction(baseClass);

    const name = cls.name;

    if (!(cls instanceof BaseComponent.constructor)) {
      // That is, `cls` is not a subclass of `BaseComponent`.
      throw new Error(`Not a component class: ${name}`);
    } else if (baseClass && !(cls instanceof baseClass.constructor)) {
      throw new Error(`Not an appropriate component class: ${name}, expected ${baseClass.name}`);
    }

    if (this.get(name, { nullIfNotFound: true })) {
      throw new Error(`Already registered: ${name}`);
    }

    this.#classes.set(name, cls);
  }
}
