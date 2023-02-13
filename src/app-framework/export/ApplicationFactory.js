// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';

import { BaseApplication } from '#x/BaseApplication';
import { ComponentRegistry } from '#x/ComponentRegistry';


/**
 * Utility class which constructs concrete {@link BaseApplication} instances,
 * along with related functionality.
 */
export class ApplicationFactory {
  /** @type {ComponentRegistry} Underlying registry instance. */
  static #REGISTRY = new ComponentRegistry();

  /**
   * Gets the application class for the given name.
   *
   * @param {string} name Name of the application class.
   * @param {boolean} [nullIfNotFound = false] Throw an error if not found?
   * @returns {?function(new:BaseApplication)} Corresponding application class,
   *   or `null` if not found and `nullIfNotFound === true`.
   * @throws {Error} Thrown if there is no such application.
   */
  static classFromName(name, nullIfNotFound = false) {
    return this.#REGISTRY.get(name, {
      class: BaseApplication,
      nullIfNotFound
    });
  }

  /**
   * Finds the configuration class associated with the given application name.
   * This method is suitable for calling within a mapper argument to {@link
   * BaseConfig#parseArray}.
   *
   * @param {string} name Name of the application class.
   * @returns {function(new:ApplicationConfig)} Corresponding configuration
   *   class.
   */
  static configClassFromName(name) {
    return this.#REGISTRY.get(name, {
      class: BaseApplication,
      wantConfig: true
    });
  }

  /**
   * Gets an array of all registered classes.
   *
   * @returns {(function(new:BaseApplication, ...*))[]} The classes.
   */
  static getAll() {
    return this.#REGISTRY.getAll();
  }

  /**
   * Constructs an application instance based on the given configuration.
   *
   * @param {ApplicationConfig} config Configuration object.
   * @param {...*} rest Other construction arguments.
   * @returns {BaseApplication} Constructed application instance.
   */
  static makeInstance(config, ...rest) {
    return this.#REGISTRY.makeInstance(config, ...rest);
  }

  /**
   * Registers an application.
   *
   * @param {function(new:BaseApplication, ...*)} cls Application class.
   */
  static register(cls) {
    this.#REGISTRY.register(cls, BaseApplication);
  }
}
