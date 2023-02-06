// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';

import { ApplicationController } from '#x/ApplicationController';
import { ApplicationFactory } from '#x/ApplicationFactory';
import { BaseControllable } from '#x/BaseControllable';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the high-level applications that are running or
 * to be run in the system.
 */
export class ApplicationManager {
  /**
   * @type {Map<string, ApplicationController>} Map from each application name
   * to the controller that should be used for it.
   */
  #controllers = new Map();

  /** @type {function(...*)} Logger for this instance (the manager). */
  #logger = ThisModule.logger.apps;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig[]} configs Configuration objects.
   */
  constructor(configs) {
    for (const config of configs) {
      this.#addControllerFor(config);
    }
  }

  /**
   * Finds the {@link ApplicationController} for a given application name.
   *
   * @param {string} name Application name to look for.
   * @returns {ApplicationController} The associated controller.
   * @throws {Error} Thrown if there is no controller with the given name.
   */
  findController(name) {
    const controller = this.#controllers.get(name);

    if (!controller) {
      throw new Error(`No such application: ${name}`);
    }

    return controller;
  }

  /**
   * Gets a list of all controllers managed by this instance.
   *
   * @returns {ApplicationController[]} All the controllers.
   */
  getAll() {
    return [...this.#controllers.values()];
  }

  /**
   * Starts all applications. This async-returns once all applications are
   * started.
   *
   * @param {boolean} isReload Reload flag.
   */
  async start(isReload) {
    BaseControllable.logStarting(this.#logger, isReload);

    const applications = this.getAll();
    const results      = applications.map((s) => s.start(isReload));

    await Promise.all(results);
    BaseControllable.logStarted(this.#logger, isReload);
  }

  /**
   * Stops all applications. This async-returns once all applications are
   * stopped.
   *
   * @param {boolean} willReload Reload flag.
   */
  async stop(willReload) {
    BaseControllable.logStopping(this.#logger, willReload);

    const applications = this.getAll();
    const results      = applications.map((s) => s.stop(willReload));

    await Promise.all(results);
    BaseControllable.logStopped(this.#logger, willReload);
  }

  /**
   * Constructs a {@link ApplicationController} based on the given information,
   * and adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {ApplicationConfig} config Parsed configuration item.
   */
  #addControllerFor(config) {
    const name = config.name;

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate application: ${name}`);
    }

    const appLogger  = ThisModule.baseApplicationLogger[name];
    const instance   = ApplicationFactory.makeInstance(config, appLogger);
    const controller = new ApplicationController(instance);

    this.#controllers.set(name, controller);
    this.#logger.bound(name);
  }
}
