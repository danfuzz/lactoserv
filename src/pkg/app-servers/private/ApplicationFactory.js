// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseApplication } from '#p/BaseApplication';


/**
 * Utility class which constructs of concrete {@link BaseApplication} instances.
 */
export class ApplicationFactory {
  /**
   * @type {Map<string, function(new:BaseApplication, ...*)>} Map from each
   * application type to the application subclass that handles it.
   */
  static #APPLICATION_CLASSES = new Map();

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
    const cls = this.#APPLICATION_CLASSES.get(type);
    if (!cls) {
      throw new Error(`Unknown applicaton type: ${type}`);
    }

    return new cls(...rest);
  }
}
