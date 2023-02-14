// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EndpointConfig } from '#x/EndpointConfig';
import { MountConfig } from '#x/MountConfig';
import { NamedConfig } from '#x/NamedConfig';
import { ServiceUseConfig } from '#x/ServiceUseConfig';


/**
 * Configuration representation for a "server" item, that is, the thing that
 * answers network requests and routes them to one or more applications, and
 * which can also be hooked up to one or more auxiliary services.
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * Bindings as defined by the superclass, {@link NamedConfig}.
 * * `{object} endpoint` -- Endpoint configuration, suitable for passing to the
 *   {@link EndpointConfig} constructor.
 * * `{object[]} mounts` -- Array of application mounts, each of a form suitable
 *   for passing to the {@link MountConfig} constructor.
 * * `{object} services` -- Mapping of service roles to the names of services
 *   which are to fill those roles, suitable for passing to the {@link
 *   ServiceUseConfig} constructor.
 */
export class ServerConfig extends NamedConfig {
  /** @type {EndpointConfig} Endpoint configuration. */
  #endpoint;

  /** @type {MountConfig[]} Array of application mounts. */
  #mounts;

  /** @type {ServiceUseConfig} Role-to-service mappings. */
  #services;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const {
      endpoint,
      mounts,
      services = {}
    } = config;

    this.#endpoint      = new EndpointConfig(endpoint);
    this.#mounts        = MountConfig.parseArray(mounts);
    this.#services      = new ServiceUseConfig(services);
  }

  /** @returns {EndpointConfig} Endpoint configuration. */
  get endpoint() {
    return this.#endpoint;
  }

  /** @returns {MountConfig[]} Array of application mounts. */
  get mounts() {
    return this.#mounts;
  }

  /** @returns {ServiceUseConfig} Role-to-service configuration. */
  get services() {
    return this.#services;
  }
}
