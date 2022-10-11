// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseService } from '#x/BaseService';


/**
 * Utility class which constructs of concrete {@link BaseService} instances.
 */
export class ServiceFactory {
  /**
   * @type {Map<string, function(new:BaseService, ...*)>} Map from each service
   * type to the service subclass that implements it.
   */
  static #SERVICE_CLASSES = new Map();

  /**
   * Registers a type/application binding.
   *
   * @param {function(new:BaseService, ...*)} serviceClass Application
   *   class.
   */
  static register(serviceClass) {
    const type = serviceClass.TYPE;

    if (this.#SERVICE_CLASSES.has(type)) {
      throw new Error(`Already registered: ${type}`);
    }

    this.#SERVICE_CLASSES.set(type, serviceClass);
  }

  /**
   * Finds the class corresponding to the given service type.
   *
   * @param {string} type Type name of the service.
   * @returns {?function(new:BaseService)} Corresponding class, or `null` if
   *   there is none.
   */
  static classFromType(type) {
    return this.#SERVICE_CLASSES.get(type) ?? null;
  }

  /**
   * Constructs an instance of the given service type.
   *
   * @param {string} type Type name of the service.
   * @param {...*} rest Construction arguments.
   * @returns {BaseService} Constructed service instance.
   */
  static forType(type, ...rest) {
    const cls = this.classFromType(type);
    if (!cls) {
      throw new Error(`Unknown service type: ${type}`);
    }

    return new cls(...rest);
  }
}
