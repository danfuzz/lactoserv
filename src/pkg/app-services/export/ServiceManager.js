// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceItem } from '@this/app-config';
import { Loggy } from '@this/loggy';

import { BaseService } from '#x/BaseService';
import { ServiceController } from '#x/ServiceController';
import { ServiceFactory } from '#x/ServiceFactory';


/** @type {function(...*)} Logger for this class. */
const logger = Loggy.loggerFor('service');

/**
 * Manager for dealing with all the high-level system services that are running
 * or could be run in the system. Configuration object details:
 *
 * * `{object|object[]} services` -- Objects, each of which represents
 *   configuration information for a single service. Each item must be a
 *   value suitable for passing to the {@link ServiceItem} (or subclass)
 *   constructor.
 */
export class ServiceManager {
  /**
   * @type {Map<string, ServiceController>} Map from each service name to the
   * controller that should be used for it.
   */
  #controllers = new Map();

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    const services = ServiceItem.parseArray(
      config.services,
      item => ServiceFactory.configClassFromType(item.type));

    for (const service of services) {
      this.#addControllerFor(service);
    }
  }

  /**
   * Finds the {@link ServiceController} for a given service name.
   *
   * @param {string} name Service name to look for.
   * @param {?string|function(new:BaseService)} [type = null] Required type
   *   (class or string name) of the service.
   * @returns {ServiceController} The associated controller.
   * @throws {Error} Thrown if there is no controller with the given name, or
   *   it does not match the given `type`.
   */
  findController(name, type = null) {
    const controller = this.#controllers.get(name);
    const cls        = ServiceManager.#classFromType(type);

    if (!controller) {
      throw new Error(`No such service: ${name}`);
    } else if (cls && !(controller instanceof cls)) {
      throw new Error(`Wrong type for service: ${name}`);
    }

    return controller;
  }

  /**
   * Gets a list of all controllers managed by this instance, optionally
   * filtered to only be those of a particular class or (string) type.
   *
   * @param {?string|function(new:BaseService)} [type = null] Class or (string)
   *   type to restrict results to, or `null` just to get everything.
   * @returns {ServiceController[]} All the matching controllers.
   */
  getAll(type = null) {
    const cls = ServiceManager.#classFromType(type);

    const result = [];
    for (const controller of this.#controllers.values()) {
      if ((cls === null) || (controller instanceof cls)) {
        result.push(controller);
      }
    }

    return result;
  }

  /**
   * Constructs a {@link ServiceController} based on the given information,
   * and adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {ServiceItem} config Parsed configuration item.
   */
  #addControllerFor(config) {
    const controller = new ServiceController(config, logger);
    const name       = controller.name;

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate service: ${name}`);
    }

    this.#controllers.set(name, controller);
    logger.bound(name);
  }


  //
  // Static members
  //

  /**
   * Gets a class (or null) from a "type spec" for a service.
   *
   * @param {?string|function(new:BaseService)} type Class or (string) type
   *   name, or `null` to not have any type restriction.
   * @returns {?function(new:BaseService)} The corresponding class, or `null` if
   *   given `null`.
   */
  static #classFromType(type) {
    if (type === null) {
      return null;
    } else if (typeof type === 'string') {
      return ServiceFactory.classFromType(type);
    } else {
      // This asks the question, "Is `type` a subclass of `BaseService`?"
      if (!(type instanceof BaseService.constructor)) {
        throw new Error(`Not a service class: ${type}`);
      }
      return type;
    }
  }
}
