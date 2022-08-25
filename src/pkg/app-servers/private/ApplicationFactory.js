// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { RedirectApplication } from '#x/RedirectApplication';
import { StaticApplication } from '#x/StaticApplication';

/**
 * Utility class which constructs of concrete {@link BaseApplication} instances.
 */
export class ApplicationFactory {
  /** {Map<string, class>} Map from each application type to the application
   * subclass that handles it. Initialized with the built-in types. */
  static #APPLICATION_CLASSES = new Map(Object.entries({
    'redirect-server': RedirectApplication,
    'static-server': StaticApplication
  }));

  /**
   * Registers a type/application binding.
   *
   * @param {string} type Type name of the application.
   * @param {class} applicationClass Corresponding application class.
   */
  static registerApplication(type, applicationClass) {
    if (this.#APPLICATION_CLASSES.has(type)) {
      throw new Error(`Already registered: ${type}`);
    }

    this.#APPLICATION_CLASSES.set(type, applicationClass);
  }

  /**
   * Constructs an instance of the given application type.
   *
   * @param {string} type Type name of the application.
   * @param {Warehouse} warehouse Warehouse of configured parts.
   * @returns {BaseApplication} Constructed application instance.
   */
  static forType(type, warehouse) {
    const cls = this.#APPLICATION_CLASSES.get(type);
    if (cls === null) {
      throw new Error(`Unknown protocol: ${protocol}`);
    }

    return new cls(warehouse);
  }
}
