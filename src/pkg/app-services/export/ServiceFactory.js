// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceItem } from '@this/app-config';

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
   * Gets the service class for the given type.
   *
   * @param {string} type Type name of the service.
   * @param {boolean} [nullIfNotFound = false] Throw an error if not found?
   * @returns {?function(new:BaseService)} Corresponding service class, or`null`
   *   if not found and `nullIfNotFound === true`.
   * @throws {Error} Thrown if there is no such service.
   */
  static classFromType(type, nullIfNotFound = false) {
    const cls = this.#SERVICE_CLASSES.get(type);

    if (cls) {
      return cls;
    } else if (nullIfNotFound) {
      return null;
    } else {
      throw new Error(`Unknown service type: ${type}`);
    }
  }

  /**
   * Finds the configuration class associated with the given type name. This
   * method is suitable for calling within a mapper argument to {@link
   * BaseConfigurationItem#parseArray}.
   *
   * @param {string} type Service type name.
   * @returns {function(new:ServiceItem)} Corresponding configuration class.
   */
  static configClassFromType(type) {
    const cls = this.classFromType(type);
    return cls.CONFIG_CLASS;
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
    return new cls(...rest);
  }

  /**
   * Registers a type/service binding.
   *
   * @param {function(new:BaseService, ...*)} serviceClass Service class.
   */
  static register(serviceClass) {
    const type = serviceClass.TYPE;

    if (this.classFromType(type, true)) {
      throw new Error(`Already registered: ${type}`);
    }

    this.#SERVICE_CLASSES.set(type, serviceClass);
  }
}
