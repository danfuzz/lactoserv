// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';

import { BaseService } from '#x/BaseService';


/**
 * Utility class which constructs of concrete {@link BaseService} instances.
 */
export class ServiceFactory {
  /**
   * @type {Map<string, function(new:BaseService, ...*)>} Map from each
   * registerered service class name to the service subclass that handles it.
   */
  static #SERVICE_CLASSES = new Map();

  /**
   * Gets the service class for the given name.
   *
   * @param {string} name Name of the service class.
   * @param {boolean} [nullIfNotFound = false] Throw an error if not found?
   * @returns {?function(new:BaseService)} Corresponding service class, or`null`
   *   if not found and `nullIfNotFound === true`.
   * @throws {Error} Thrown if there is no such service.
   */
  static classFromName(name, nullIfNotFound = false) {
    const cls = this.#SERVICE_CLASSES.get(name);

    if (cls) {
      return cls;
    } else if (nullIfNotFound) {
      return null;
    } else {
      throw new Error(`Unknown service: ${name}`);
    }
  }

  /**
   * Finds the configuration class associated with the given service name. This
   * method is suitable for calling within a mapper argument to {@link
   * BaseConfig#parseArray}.
   *
   * @param {string} name Name of the service class.
   * @returns {function(new:ServiceConfig)} Corresponding configuration class.
   */
  static configClassFromName(name) {
    const cls = this.classFromName(name);
    return cls.CONFIG_CLASS;
  }

  /**
   * Constructs a service instance based on the given configuration.
   *
   * @param {ServiceConfig} config Configuration object.
   * @param {...*} rest Other construction arguments.
   * @returns {BaseService} Constructed service instance.
   */
  static makeInstance(config, ...rest) {
    const cls = this.classFromName(config.type);
    return new cls(config, ...rest);
  }

  /**
   * Registers a service class.
   *
   * @param {function(new:BaseService, ...*)} serviceClass Service class.
   */
  static register(serviceClass) {
    const name = serviceClass.TYPE;

    if (this.classFromName(name, true)) {
      throw new Error(`Already registered: ${name}`);
    }

    this.#SERVICE_CLASSES.set(name, serviceClass);
  }
}
