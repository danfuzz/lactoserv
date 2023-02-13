// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';

import { BaseService } from '#x/BaseService';
import { ComponentRegistry } from '#x/ComponentRegistry';


/**
 * Utility class which constructs of concrete {@link BaseService} instances.
 */
export class ServiceFactory {
  /** @type {ComponentRegistry} Underlying registry instance. */
  static #REGISTRY = new ComponentRegistry();

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
    return this.#REGISTRY.get(name, {
      class: BaseService,
      nullIfNotFound
    });
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
    return this.#REGISTRY.get(name, {
      class: BaseService,
      wantConfig: true
    });
  }

  /**
   * Gets an array of all registered classes.
   *
   * @returns {(function(new:BaseService, ...*))[]} The classes.
   */
  static getAll() {
    return this.#REGISTRY.getAll();
  }

  /**
   * Constructs a service instance based on the given configuration.
   *
   * @param {ServiceConfig} config Configuration object.
   * @param {...*} rest Other construction arguments.
   * @returns {BaseService} Constructed service instance.
   */
  static makeInstance(config, ...rest) {
    return this.#REGISTRY.makeInstance(config, ...rest);
  }

  /**
   * Registers a service class.
   *
   * @param {function(new:BaseService, ...*)} cls Service class.
   */
  static register(cls) {
    this.#REGISTRY.register(cls, BaseService);
  }
}
