// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Utility class which constructs of concrete {@link BaseApplication} instances.
 */
export class ApplicationFactory {
  /** {Map<string, class>} Map from each application type to the application
   * subclass that handles it. */
  static #APPLICATION_CLASSES = new Map();

  /**
   * Registers a type/application binding.
   *
   * @param {string} type Type name of the application.
   * @param {class} applicationClass Corresponding application class.
   */
  static register(type, applicationClass) {
    if (this.#APPLICATION_CLASSES.has(type)) {
      throw new Error(`Already registered: ${type}`);
    }

    this.#APPLICATION_CLASSES.set(type, applicationClass);
  }

  /**
   * Constructs an instance of the given application type.
   *
   * @param {string} type Type name of the application.
   * @param {array} rest Construction arguments.
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
