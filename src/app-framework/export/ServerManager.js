// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MountConfig, ServerConfig } from '@this/app-config';

import { BaseApplication } from '#x/BaseApplication';
import { BaseComponent } from '#x/BaseComponent';
import { ServerController } from '#x/ServerController';
import { ThisModule } from '#p/ThisModule';
import { Warehouse } from '#x/Warehouse';


/**
 * Manager for dealing with all the network-bound server endpoints of a system.
 */
export class ServerManager {
  /** @type {Warehouse} The warehouse this instance is in. */
  #warehouse;

  /**
   * @type {Map<string, ServerController>} Map from each server name to the
   * {@link ServerController} object with that name.
   */
  #controllers = new Map();

  /** @type {function(...*)} Logger for this instance (the manager). */
  #logger = ThisModule.logger.servers;

  /**
   * Constructs an instance.
   *
   * @param {ServerConfig[]} configs Configuration objects.
   * @param {Warehouse} warehouse The warehouse this instance is in.
   */
  constructor(configs, warehouse) {
    this.#warehouse = warehouse;

    for (const config of configs) {
      this.#addControllerFor(config);
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
   * Starts all servers. This async-returns once all servers are started.
   *
   * @param {boolean} isReload Reload flag.
   */
  async start(isReload) {
    BaseComponent.logStarting(this.#logger, isReload);

    const servers = this.getAll();
    const results = servers.map((s) => s.start(isReload));

    await Promise.all(results);
    BaseComponent.logStarted(this.#logger, isReload);
  }

  /**
   * Stops all servers. This async-returns once all servers are stopped.
   *
   * @param {boolean} willReload Reload flag.
   */
  async stop(willReload) {
    BaseComponent.logStopping(this.#logger, willReload);

    const servers = this.getAll();
    const results = servers.map((s) => s.stop(willReload));

    await Promise.all(results);
    BaseComponent.logStopped(this.#logger, willReload);
  }

  /**
   * Constructs a {@link ServerController} based on the given information, and
   * adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {ServerConfig} config Parsed configuration item.
   */
  #addControllerFor(config) {
    const {
      endpoint: { hostnames },
      mounts,
      name,
      services: { rateLimiter: limName, requestLogger: logName }
    } = config;

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate server name: ${name}`);
    }

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
      logger:         ThisModule.baseServerLogger[name],
      rateLimiter,
      requestLogger
    };

    const controller = new ServerController(config, extraConfig);

    this.#controllers.set(name, controller);
    this.#logger.bound(name);
  }

  /**
   * Makes an `applicationMap` map suitable for use in constructing a {@link
   * ServerController}, by also using the {@link #warehouse} to look up
   * application name bindings.
   *
   * @param {MountConfig[]} mounts Original `mounts` configuration item.
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
