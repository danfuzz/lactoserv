// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';

import { BaseControllable } from '#x/BaseControllable';
import { BaseService } from '#x/BaseService';
import { ServiceFactory } from '#x/ServiceFactory';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the high-level system services that are running
 * or could be run in the system.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the services.
 */
export class ServiceManager extends BaseControllable {
  /**
   * @type {Map<string, BaseApplication>} Map from each bound service name to
   * the corresponding instance.
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig[]} configs Configuration objects.
   */
  constructor(configs) {
    super(ThisModule.logger.services);

    for (const config of configs) {
      this.#addInstanceFor(config);
    }
  }

  /**
   * Finds the {@link BaseService} for a given service name.
   *
   * @param {string} name Service name to look for.
   * @param {?string|function(new:BaseService)} [type = null] Required type
   *   (class or string name) of the service.
   * @returns {BaseService} The associated instance.
   * @throws {Error} Thrown if there is no instance with the given name, or it
   *   does not match the given `type`.
   */
  findService(name, type = null) {
    const instance = this.#instances.get(name);
    const cls      = ServiceManager.#classFromType(type);

    if (!instance) {
      throw new Error(`No such service: ${name}`);
    } else if (cls && !(instance instanceof cls)) {
      throw new Error(`Wrong type for service: ${name}`);
    }

    return instance;
  }

  /**
   * Gets a list of all instances managed by this instance, optionally filtered
   * to only be those of a particular class or (string) type.
   *
   * @param {?string|function(new:BaseService)} [type = null] Class or (string)
   *   type to restrict results to, or `null` just to get everything.
   * @returns {BaseService[]} All the matching instances.
   */
  getAll(type = null) {
    const cls = ServiceManager.#classFromType(type);

    const result = [];
    for (const controller of this.#instances.values()) {
      if ((cls === null) || (controller instanceof cls)) {
        result.push(controller);
      }
    }

    return result;
  }

  /** @override */
  async _impl_start(isReload) {
    const services = this.getAll();
    const results  = services.map((s) => s.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const services = this.getAll();
    const results  = services.map((s) => s.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Constructs a {@link BaseService} based on the given information, and adds a
   * mapping to {@link #instances} so it can be found.
   *
   * @param {ServiceConfig} config Parsed configuration item.
   */
  #addInstanceFor(config) {
    const name = config.name;

    if (this.#instances.has(name)) {
      throw new Error(`Duplicate service: ${name}`);
    }

    const serviceLogger = ThisModule.baseServiceLogger[name];
    const instance      = ServiceFactory.makeInstance(config, serviceLogger);

    this.#instances.set(name, instance);
    this.logger.bound(name);
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
