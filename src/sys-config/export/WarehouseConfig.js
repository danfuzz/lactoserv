// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ApplicationConfig } from '#x/ApplicationConfig';
import { BaseConfig } from '#x/BaseConfig';
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
 * * `{object|object[]} services` -- Optional system service configuration.
 *   If not present, no services are configured.
 */
export class WarehouseConfig extends BaseConfig {
  /**
   * Application configuration objects.
   *
   * @type {Array<ApplicationConfig>}
   */
  #applications;

  /**
   * Host configuration objects.
   *
   * @type {Array<HostConfig>}
   */
  #hosts;

  /**
   * Endpoint configuration objects.
   *
   * @type {Array<EndpointConfig>}
   */
  #endpoints;

  /**
   * Service configuration objects.
   *
   * @type {Array<ServiceConfig>}
   */
  #services;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const {
      applications,
      endpoints,
      hosts = [],
      services = []
    } = config;

    this.#applications = ApplicationConfig.parseArray(applications);
    this.#hosts        = HostConfig.parseArray(hosts);
    this.#endpoints    = EndpointConfig.parseArray(endpoints);
    this.#services     = ServiceConfig.parseArray(services);
  }

  /** @returns {Array<ApplicationConfig>} Application configuration objects. */
  get applications() {
    return this.#applications;
  }

  /** @returns {Array<HostConfig>} Host configuration objects. */
  get hosts() {
    return this.#hosts;
  }

  /** @returns {Array<EndpointConfig>} Endpoint configuration objects. */
  get endpoints() {
    return this.#endpoints;
  }

  /** @returns {Array<ServiceConfig>} Service configuration objects. */
  get services() {
    return this.#services;
  }
}
