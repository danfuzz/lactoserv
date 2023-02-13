// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MountConfig, ServerConfig } from '@this/app-config';

import { BaseApplication } from '#x/BaseApplication';
import { BaseControllable } from '#x/BaseControllable';
import { NetworkServer } from '#x/NetworkServer';
import { ThisModule } from '#p/ThisModule';
import { Warehouse } from '#x/Warehouse';


/**
 * Manager for dealing with all the network-bound server endpoints of a system.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the servers.
 */
export class ServerManager extends BaseControllable {
  /** @type {Warehouse} The warehouse this instance is in. */
  #warehouse;

  /**
   * @type {Map<string, NetworkServer>} Map from each server name to the
   * {@link NetworkServer} object with that name.
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {ServerConfig[]} configs Configuration objects.
   * @param {Warehouse} warehouse The warehouse this instance is in.
   */
  constructor(configs, warehouse) {
    super(ThisModule.logger.servers);

    this.#warehouse = warehouse;

    for (const config of configs) {
      this.#addInstanceFor(config);
    }
  }

  /**
   * Finds the {@link NetworkServer} for a given name.
   *
   * @param {string} name Server name to look for.
   * @returns {NetworkServer} The associated server.
   * @throws {Error} Thrown if there is no server with the given name.
   */
  findServer(name) {
    const instance = this.#instances.get(name);

    if (!instance) {
      throw new Error(`No such server: ${name}`);
    }

    return instance;
  }

  /**
   * Gets a list of all servers managed by this instance.
   *
   * @returns {NetworkServer[]} All the servers.
   */
  getAll() {
    return [...this.#instances.values()];
  }

  /** @override */
  async _impl_start(isReload) {
    const servers = this.getAll();
    const results = servers.map((s) => s.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const servers = this.getAll();
    const results = servers.map((s) => s.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Constructs a {@link NetworkServer} based on the given information, and
   * adds a mapping to {@link #instances} so it can be found.
   *
   * @param {ServerConfig} config Parsed configuration item.
   */
  #addInstanceFor(config) {
    const {
      endpoint: { hostnames },
      mounts,
      name,
      services: { rateLimiter: limName, requestLogger: logName }
    } = config;

    if (this.#instances.has(name)) {
      throw new Error(`Duplicate server name: ${name}`);
    }

    const { hostManager, serviceManager } = this.#warehouse;

    const hmSubset = hostManager
      ? hostManager.makeSubset(hostnames)
      : null;
    const rateLimiter = limName
      ? serviceManager.get(limName)
      : null;
    const requestLogger = logName
      ? serviceManager.get(logName)
      : null;

    const extraConfig = {
      applicationMap: this.#makeApplicationMap(mounts),
      hostManager:    hmSubset,
      logger:         ThisModule.baseServerLogger[name],
      rateLimiter,
      requestLogger
    };

    const instance = new NetworkServer(config, extraConfig);

    this.#instances.set(name, instance);
    this.logger.bound(name);
  }

  /**
   * Makes an `applicationMap` map suitable for use in constructing a {@link
   * NetworkServer}, by also using the {@link #warehouse} to look up
   * application name bindings.
   *
   * @param {MountConfig[]} mounts Original `mounts` configuration item.
   * @returns {Map<string, BaseApplication>} Corresponding map.
   */
  #makeApplicationMap(mounts) {
    const applicationManager = this.#warehouse.applicationManager;
    const result             = new Map();

    for (const { application } of mounts) {
      if (!result.has(application)) {
        const found = applicationManager.get(application);
        result.set(application, found);
      }
    }

    return result;
  }
}
