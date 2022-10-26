// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationItem } from '@this/app-config';

import { ApplicationController } from '#x/ApplicationController';
import { ApplicationFactory } from '#x/ApplicationFactory';
import { ThisModule } from '#p/ThisModule';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.app;

/**
 * Manager for dealing with all the high-level applications that are running or
 * to be run in the system. Configuration object details:
 *
 * * `{object|object[]} applications` -- Objects, each of which represents
 *   configuration information for a single application. Each item must be a
 *   value suitable for passing to the {@link ApplicationItem} (or subclass)
 *   constructor.
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
   * @param {object} config Configuration object.
   */
  constructor(config) {
    const applications = ApplicationItem.parseArray(
      config.applications,
      item => ApplicationFactory.configClassFromType(item.type));

    for (const application of applications) {
      this.#addControllerFor(application);
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
   * @param {ApplicationItem} config Parsed configuration item.
   */
  #addControllerFor(config) {
    const controller = new ApplicationController(config, logger);
    const name       = controller.name;

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate application: ${name}`);
    }

    this.#controllers.set(name, controller);
    logger.bound(name);
  }
}
