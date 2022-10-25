// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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
   * Finds the configuration class associated with the given type name. This
   * method is suitable for calling within a mapper argument to {@link
   * BaseConfigurationItem#parseArray}.
   *
   * @param {string} type Application type name.
   * @returns {function(new:ApplicationItem)} Corresponding configuration item
   *   parser.
   */
  static configClassFromType(type) {
    const cls = this.#find(type);
    return cls.CONFIG_CLASS;
  }

  /**
   * Registers a type/application binding.
   *
   * @param {function(new:BaseApplication, ...*)} applicationClass Application
   *   class.
   */
  static register(applicationClass) {
    const type = applicationClass.TYPE;

    if (this.#APPLICATION_CLASSES.has(type)) {
      throw new Error(`Already registered: ${type}`);
    }

    this.#APPLICATION_CLASSES.set(type, applicationClass);
  }

  /**
   * Constructs an instance of the given application type.
   *
   * @param {string} type Type name of the application.
   * @param {...*} rest Construction arguments.
   * @returns {BaseApplication} Constructed application instance.
   */
  static forType(type, ...rest) {
    const cls = this.#find(type);
    return new cls(...rest);
  }

  /**
   * Gets the application class for the given type.
   *
   * @param {string} type Type name of the application.
   * @returns {function(new:BaseApplication)} Corresponding application class.
   */
  static #find(type) {
    const cls = this.#APPLICATION_CLASSES.get(type);
    if (!cls) {
      throw new Error(`Unknown applicaton type: ${type}`);
    }

    return cls;
  }
}
