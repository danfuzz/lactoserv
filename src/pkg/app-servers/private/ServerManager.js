// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Names, ServerItem, Uris } from '@this/app-config';
import { JsonSchema, JsonSchemaUtil } from '@this/json';

import { ServerController } from '#p/ServerController';
import { ThisModule } from '#p/ThisModule';
import { Warehouse } from '#x/Warehouse';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.server;

/**
 * Manager for dealing with all the network-bound server endpoints of a system.
 * Configuration object details:
 *
 * * `{object|object[]} servers` -- Objects, each of which represents
 *   configuration information for a single server. Each item must be a value
 *   suitable for passing to the {@link ServerItem} constructor.
 */
export class ServerManager {
  /** @type {Warehouse} The warehouse this instance is in. */
  #warehouse;

  /**
   * @type {Map<string, ServerController>} Map from each server name to the
   * {@link ServerController} object with that name.
   */
  #controllers = new Map();

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   * @param {Warehouse} warehouse The warehouse this instance is in.
   */
  constructor(config, warehouse) {
    this.#warehouse = warehouse;

    const servers = ServerItem.parseArray(config.servers);
    for (const server of servers) {
      this.#addControllerFor(server);
    }
  }

  /**
   * Finds the {@link ServerController} for a given server name.
   *
   * @param {string} name Server name to look for.
   * @returns {ServerController} The associated controller.
   * @throws {Error} Thrown if there is no controller with the given name.
   */
  findController(name) {
    const controller = this.#controllers.get(name);

    if (!controller) {
      throw new Error(`No such server: ${name}`);
    }

    return controller;
  }

  /**
   * Gets a list of all controllers managed by this instance.
   *
   * @returns {ServerController[]} All the controllers.
   */
  getAll() {
    return [...this.#controllers.values()];
  }

  /**
   * Constructs a {@link ServerController} based on the given information, and
   * adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {ServerItem} serverItem Configuration for a single server.
   */
  #addControllerFor(serverItem) {
    const {
      hostnames,
      mounts,
      rateLimiter:   limName,
      requestLogger: logName,
    } = serverItem;
    const { hostManager, serviceManager } = this.#warehouse;

    const hmSubset = hostManager
      ? hostManager.makeSubset(hostnames)
      : null;
    const rateLimiter = limName
      ? serviceManager.findController(limName).service
      : null;
    const requestLogger = logName
      ? serviceManager.findController(logName).service
      : null;

    const extraConfig = {
      applicationMap: this.#makeApplicationMap(mounts),
      hostManager:    hmSubset,
      logger,
      rateLimiter,
      requestLogger
    };

    const controller = new ServerController(serverItem, extraConfig);
    const name       = controller.name;

    logger.binding(name);

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate server name: ${name}`);
    }

    this.#controllers.set(name, controller);
  }

  /**
   * Makes an `appMap` map suitable for use in constructing a {@link
   * ServerController}, by also using the {@link #warehouse} to look up
   * application name bindings.
   *
   * @param {MountItem[]} mounts Original `mounts` configuration item.
   * @returns {Map<string,BaseApplication>} Corresponding map.
   */
  #makeApplicationMap(mounts) {
    const applicationManager = this.#warehouse.applicationManager;
    const result             = new Map();

    for (const { application } of mounts) {
      if (!result.has(application)) {
        const controller = applicationManager.findController(application);
        result.set(application, controller);
      }
    }

    return result;
  }
}
