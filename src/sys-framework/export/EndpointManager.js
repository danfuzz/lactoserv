// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent, ControlContext } from '@this/compote';
import { EndpointConfig } from '@this/sys-config';

import { NetworkEndpoint } from '#x/NetworkEndpoint';
import { ThisModule } from '#p/ThisModule';
import { Warehouse } from '#x/Warehouse';


/**
 * Manager for dealing with all the network-bound endpoints of a system.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the endpoints.
 */
export class EndpointManager extends BaseComponent {
  /**
   * The warehouse this instance is in.
   *
   * @type {Warehouse}
   */
  #warehouse;

  /**
   * Map from each endpoint name to the {@link NetworkEndpoint} object with that
   * name.
   *
   * @type {Map<string, NetworkEndpoint>}
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {Array<EndpointConfig>} configs Configuration objects.
   * @param {Warehouse} warehouse The warehouse this instance is in.
   */
  constructor(configs, warehouse) {
    super();

    this.#warehouse = warehouse;

    for (const config of configs) {
      this.#addInstanceFor(config);
    }
  }

  /**
   * Finds the {@link NetworkEndpoint} for a given name.
   *
   * @param {string} name Endpoint name to look for.
   * @returns {NetworkEndpoint} The associated endpoint.
   * @throws {Error} Thrown if there is no endpoint with the given name.
   */
  findServer(name) {
    const instance = this.#instances.get(name);

    if (!instance) {
      throw new Error(`No such endpoint: ${name}`);
    }

    return instance;
  }

  /**
   * Gets a list of all endpoints managed by this instance.
   *
   * @returns {Array<NetworkEndpoint>} All the endpoints.
   */
  getAll() {
    return [...this.#instances.values()];
  }

  /** @override */
  async _impl_init(isReload) {
    const endpoints = this.getAll();

    const results = endpoints.map((e) => {
      const logger  = ThisModule.cohortLogger('endpoint')?.[e.name];
      const context = new ControlContext(e, this, logger);
      return e.init(context, isReload);
    });

    await Promise.all(results);
  }

  /** @override */
  async _impl_start(isReload) {
    const endpoints = this.getAll();
    const results   = endpoints.map((e) => e.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const endpoints = this.getAll();
    const results = endpoints.map((e) => e.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Constructs a {@link NetworkEndpoint} based on the given information, and
   * adds a mapping to {@link #instances} so it can be found.
   *
   * @param {EndpointConfig} config Parsed configuration item.
   */
  #addInstanceFor(config) {
    const {
      hostnames,
      name,
      services: { rateLimiter: limName, requestLogger: logName }
    } = config;

    if (this.#instances.has(name)) {
      throw new Error(`Duplicate endpoint name: ${name}`);
    }

    const { hostManager, serviceManager } = this.#warehouse;

    const hmSubset = config.requiresCertificates()
      ? hostManager.makeSubset(hostnames)
      : null;
    const rateLimiter = limName
      ? serviceManager.get(limName)
      : null;
    const requestLogger = logName
      ? serviceManager.get(logName)
      : null;

    const extraConfig = {
      hostManager: hmSubset,
      rateLimiter,
      requestLogger
    };

    const instance = new NetworkEndpoint(config, extraConfig);

    this.#instances.set(name, instance);
  }
}
