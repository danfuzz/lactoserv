// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';
import { MustBe } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';


/**
 * Utility class which constructs concrete {@link BaseApplication} instances,
 * along with related functionality.
 */
export class ApplicationFactory {
  /**
   * @type {Map<string, function(new:BaseApplication, ...*)>} Map from each
   * registerered application class name to the application subclass that
   * handles it.
   */
  static #APPLICATION_CLASSES = new Map();

  /**
   * Gets the application class for the given name.
   *
   * @param {string} name Name of the application class.
   * @param {boolean} [nullIfNotFound = false] Throw an error if not found?
   * @returns {?function(new:BaseApplication)} Corresponding application class,
   *   or `null` if not found and `nullIfNotFound === true`.
   * @throws {Error} Thrown if there is no such application.
   */
  static classFromName(name, nullIfNotFound = false) {
    const cls = this.#APPLICATION_CLASSES.get(name);

    if (cls) {
      return cls;
    } else if (nullIfNotFound) {
      return null;
    } else {
      throw new Error(`Unknown applicaton: ${name}`);
    }
  }

  /**
   * Finds the configuration class associated with the given application name.
   * This method is suitable for calling within a mapper argument to {@link
   * BaseConfig#parseArray}.
   *
   * @param {string} name Name of the application class.
   * @returns {function(new:ApplicationConfig)} Corresponding configuration
   *   class.
   */
  static configClassFromName(name) {
    const cls = this.classFromName(name);
    return cls.CONFIG_CLASS;
  }

  /**
   * Constructs an application instance based on the given configuration.
   *
   * @param {ApplicationConfig} config Configuration object.
   * @param {...*} rest Other construction arguments.
   * @returns {BaseApplication} Constructed application instance.
   */
  static makeInstance(config, ...rest) {
    const cls = this.classFromName(config.class);
    return new cls(config, ...rest);
  }

  /**
   * Registers an application.
   *
   * @param {function(new:BaseApplication, ...*)} cls Application class.
   */
  static register(cls) {
    MustBe.constructorFunction(cls);
    const name = cls.name;

    if (!(cls instanceof BaseApplication.constructor)) {
      // That is, `cls` is not a subclass of `BaseApplication`.
      throw new Error(`Not an application class: ${name}`);
    }

    if (this.classFromName(name, true)) {
      throw new Error(`Already registered: ${name}`);
    }

    this.#APPLICATION_CLASSES.set(name, cls);
  }
}
