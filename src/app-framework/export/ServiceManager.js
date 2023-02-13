// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';

import { BaseApplication } from '#x/BaseApplication';
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
   * @param {?string|function(new:BaseService)} cls Class or (string) class
   *   name that the named service must be, or `null` to not have any
   *   restriction.
   * @returns {BaseService} The associated instance.
   * @throws {Error} Thrown if there is no instance with the given name, or it
   *   does not match the given `cls`.
   */
  findService(name, cls = null) {
    const instance = this.#instances.get(name);

    if (!instance) {
      throw new Error(`No such service: ${name}`);
    }

    ServiceManager.#checkInstanceClass(instance, cls);

    return instance;
  }

  /**
   * Gets a list of all services managed by this instance.
   *
   * @returns {BaseService[]} All the services.
   */
  getAll() {
    return [...this.#instances.values()];
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
   * Checks that a service instance fits the given class restriction.
   *
   * @param {BaseService} service The service instance to check.
   * @param {?string|function(new:BaseService)} cls Class or (string) class
   *   name that `service` must be, or `null` to not have any restriction.
   * @throws {Error} Thrown if `service` is not an instance of an appropriate
   *   class.
   */
  static #checkInstanceClass(service, cls) {
    if (cls === null) {
      // No restriction per se, but it had still better be _some_ kind of
      // service.
      cls = BaseService;
    } else if (typeof cls === 'string') {
      cls = ServiceFactory.classFromName(cls);
    } else if (!(cls instanceof BaseService.constructor)) {
      // That is, `cls` is not a subclass of `BaseService`.
      throw new Error(`Not a service class: ${cls.name}`);
    }

    if (! (service instanceof cls)) {
      throw new Error(`Wrong class for service: ${service.constructor.name}, expected ${cls.name}`);
    }
  }
}
