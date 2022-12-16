// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';

import { BaseApplication } from '#x/BaseApplication';


/**
 * Utility class which constructs concrete {@link BaseApplication} instances,
 * along with related functionality.
 */
export class ApplicationFactory {
  /**
   * @type {Map<string, function(new:BaseApplication, ...*)>} Map from each
   * application type to the application subclass that handles it.
   */
  static #APPLICATION_CLASSES = new Map();

  /**
   * Gets the application class for the given type.
   *
   * @param {string} type Type name of the application.
   * @param {boolean} [nullIfNotFound = false] Throw an error if not found?
   * @returns {?function(new:BaseApplication)} Corresponding application class,
   *   or `null` if not found and `nullIfNotFound === true`.
   * @throws {Error} Thrown if there is no such application.
   */
  static classFromType(type, nullIfNotFound = false) {
    const cls = this.#APPLICATION_CLASSES.get(type);

    if (cls) {
      return cls;
    } else if (nullIfNotFound) {
      return null;
    } else {
      throw new Error(`Unknown applicaton type: ${type}`);
    }
  }

  /**
   * Finds the configuration class associated with the given type name. This
   * method is suitable for calling within a mapper argument to {@link
   * BaseConfig#parseArray}.
   *
   * @param {string} type Application type name.
   * @returns {function(new:ApplicationConfig)} Corresponding configuration
   *   class.
   */
  static configClassFromType(type) {
    const cls = this.classFromType(type);
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
    const cls = this.classFromType(config.type);
    return new cls(config, ...rest);
  }

  /**
   * Registers a type/application binding.
   *
   * @param {function(new:BaseApplication, ...*)} applicationClass Application
   *   class.
   */
  static register(applicationClass) {
    const type = applicationClass.TYPE;

    if (this.classFromType(type, true)) {
      throw new Error(`Already registered: ${type}`);
    }

    this.#APPLICATION_CLASSES.set(type, applicationClass);
  }
}
