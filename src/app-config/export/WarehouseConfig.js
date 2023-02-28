// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ApplicationConfig } from '#x/ApplicationConfig';
import { BaseConfig } from '#x/BaseConfig';
import { ConfigClassMapper } from '#x/ConfigClassMapper';
import { EndpointConfig } from '#x/EndpointConfig';
import { HostConfig } from '#x/HostConfig';
import { ServiceConfig } from '#x/ServiceConfig';


/**
 * Configuration representation for the "warehouse" (the entire system).
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * `{object|object[]} applications` -- Application configuration.
 * * `{object|object[]} endpoints` -- Endpoint configuration.
 * * `{object|object[]} hosts` -- Optional host / certificate configuration.
 *   Required only if any endpoints are configured to listen for secure
 *   connections.
 * * `{object|object[]} services` -- System service configuration.
 */
export class WarehouseConfig extends BaseConfig {
  /** @type {ApplicationConfig[]} Application configuration objects. */
  #applications;

  /** @type {HostConfig[]} Host configuration objects. */
  #hosts;

  /** @type {EndpointConfig[]} Endpoint configuration objects. */
  #endpoints;

  /** @type {ServiceConfig[]} Service configuration objects. */
  #services;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   * @param {ConfigClassMapper} configClassMapper Mapper from configuration
   *   objects to corresponding configuration classes.
   */
  constructor(config, configClassMapper) {
    super(config);

    const {
      applications,
      endpoints,
      hosts = [],
      services
    } = config;

    this.#applications = ApplicationConfig.parseArray(applications, configClassMapper);
    this.#hosts        = HostConfig.parseArray(hosts, configClassMapper);
    this.#endpoints    = EndpointConfig.parseArray(endpoints, configClassMapper);
    this.#services     = ServiceConfig.parseArray(services, configClassMapper);
  }

  /** @returns {ApplicationConfig[]} Application configuration objects. */
  get applications() {
    return this.#applications;
  }

  /** @returns {HostConfig[]} Host configuration objects. */
  get hosts() {
    return this.#hosts;
  }

  /** @returns {EndpointConfig[]} Endpoint configuration objects. */
  get endpoints() {
    return this.#endpoints;
  }

  /** @returns {ServiceConfig[]} Service configuration objects. */
  get services() {
    return this.#services;
  }
}
