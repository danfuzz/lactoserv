// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConfig, ClassedConfig, ConfigClassMapper } from '@this/app-config';
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
   * @returns {ConfigClassMapper} A configuration class mapper function which
   * uses this instance for its lookups.
   */
  get configClassMapper() {
    return (config, baseClass) => this.configClassFor(config, baseClass);
  }

  /**
   * Given a configuration object and a desired base class for the result,
   * returns the configuration class which should be used to instantiate the
   * configuration. This is the method behind {@link #configClassMapper}.
   *
   * @param {object} config Plain object representing the configuration in
   *   question.
   * @param {function(new:BaseConfig)} [baseClass = null] Required base class
   *   for the result. `null` is equivalent to just `BaseConfig`.
   * @returns {function(new:BaseConfig)} Actual class which should be used to
   *   instantiate the configuration.
   */
  configClassFor(config, baseClass = null) {
    MustBe.plainObject(config);
    baseClass = (baseClass === null)
      ? BaseConfig
      : MustBe.instanceOf(baseClass, BaseConfig.constructor);

    const name  = config.class;
    const found = this.get(name, {
      nullIfNotFound: true,
      wantConfig:     true
    });

    if (found === null) {
      // There is no more-specific registered class.
      return baseClass;
    }

    if (!(found instanceof baseClass.constructor)) {
      throw new Error(`Not an appropriate component class: ${name}, expected ${baseClass.name}`);
    }

    return found;
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
   * Gets an array of all classes registered by this instance.
   *
   * @returns {(function(new:BaseComponent, ...*))[]} The classes.
   */
  getAll() {
    return [...this.#classes.values()];
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

    if (!(config instanceof cls.CONFIG_CLASS)) {
      throw new Error(`Mismatched configuration class for component: ${config.class}`);
    }

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
