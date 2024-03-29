// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent, ControlContext } from '@this/compote';

import { NetworkEndpoint } from '#x/NetworkEndpoint';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the network-bound endpoints of a system.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the endpoints.
 *
 * TODO: This class can probably be replaced by just another instance of
 * `ComponentManager`.
 */
export class EndpointManager extends BaseComponent {
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
   * @param {Array<NetworkEndpoint>} endpoints Endpoint instances.
   */
  constructor(endpoints) {
    super();

    for (const endpoint of endpoints) {
      this.#addInstance(endpoint);
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
   * Validates the given instance, and adds it to {@link #instances}.
   *
   * @param {NetworkEndpoint} endpoint Endpoint instance.
   */
  #addInstance(endpoint) {
    const name = endpoint.name;

    if (this.#instances.has(name)) {
      throw new Error(`Duplicate endpoint: ${name}`);
    }

    this.#instances.set(name, endpoint);
  }
}
