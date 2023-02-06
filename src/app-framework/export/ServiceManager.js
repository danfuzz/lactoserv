// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';

import { BaseControllable } from '#x/BaseControllable';
import { BaseService } from '#x/BaseService';
import { ServiceController } from '#x/ServiceController';
import { ServiceFactory } from '#x/ServiceFactory';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the high-level system services that are running
 * or could be run in the system.
 */
export class ServiceManager {
  /**
   * @type {Map<string, ServiceController>} Map from each service name to the
   * controller that should be used for it.
   */
  #controllers = new Map();

  /** @type {function(...*)} Logger for this instance (the manager). */
  #logger = ThisModule.logger.services;

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig[]} configs Configuration objects.
   */
  constructor(configs) {
    for (const config of configs) {
      this.#addControllerFor(config);
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
   * Starts all services. This async-returns once all services are started.
   *
   * @param {boolean} isReload Reload flag.
   */
  async start(isReload) {
    BaseControllable.logStarting(this.#logger, isReload);

    const services = this.getAll();
    const results  = services.map((s) => s.start(isReload));

    await Promise.all(results);
    BaseControllable.logStarted(this.#logger, isReload);
  }

  /**
   * Stops all services. This async-returns once all services are stopped.
   *
   * @param {boolean} willReload Reload flag.
   */
  async stop(willReload) {
    BaseControllable.logStopping(this.#logger, willReload);

    const services = this.getAll();
    const results  = services.map((s) => s.stop(willReload));

    await Promise.all(results);
    BaseControllable.logStopped(this.#logger, willReload);
  }

  /**
   * Constructs a {@link ServiceController} based on the given information,
   * and adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {ServiceConfig} config Parsed configuration item.
   */
  #addControllerFor(config) {
    const name = config.name;

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate service: ${name}`);
    }

    const serviceLogger = ThisModule.baseServiceLogger[name];
    const instance      = ServiceFactory.makeInstance(config, serviceLogger);
    const controller    = new ServiceController(instance);

    this.#controllers.set(name, controller);
    this.#logger.bound(name);
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
