// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import { ApplicationConfig } from '@this/app-config';

import { ApplicationController } from '#x/ApplicationController';
import { ApplicationFactory } from '#x/ApplicationFactory';
import { ThisModule } from '#p/ThisModule';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.app;

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

    const subLogger  = logger[name];
    const instance   = ApplicationFactory.makeInstance(config, subLogger);
    const controller = new ApplicationController(instance);

    this.#controllers.set(name, controller);
    subLogger.bound();
  }
}
