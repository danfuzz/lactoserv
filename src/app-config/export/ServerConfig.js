// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MountConfig } from '#x/MountConfig';
import { NamedConfig } from '#x/NamedConfig';
import { ServiceUseConfig } from '#x/ServiceUseConfig';
import { Uris } from '#x/Uris';
import { Util } from '#x/Util';


/**
 * Configuration representation for an endpoint item, that is, the thing that
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
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /** @type {string} Address of the physical interface to listen on. */
  #interface;

  /** @type {number} Port to listen on. */
  #port;

  /** @type {string} High-level protocol to speak. */
  #protocol;

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
      hostnames = '*',
      interface: iface, // `interface` is a reserved word.
      port,
      protocol,
    } = config.endpoint ?? config;

    const {
      mounts,
      services = {}
    } = config;

    this.#hostnames = Util.checkAndFreezeStrings(hostnames, Uris.HOSTNAME_PATTERN);
    this.#interface = Uris.checkInterface(iface);
    this.#port      = Uris.checkPort(port);
    this.#protocol  = Uris.checkProtocol(protocol);
    this.#mounts    = MountConfig.parseArray(mounts);
    this.#services  = new ServiceUseConfig(services);
  }

  /**
   * @returns {string[]} List of hostnames, including possibly subdomain and/or
   * full wildcards.
   */
  get hostnames() {
    return this.#hostnames;
  }

  /** @returns {string} Address of the physical interface to listen on. */
  get interface() {
    return this.#interface;
  }

  /** @returns {MountConfig[]} Array of application mounts. */
  get mounts() {
    return this.#mounts;
  }

  /** @returns {number} Port to listen on. */
  get port() {
    return this.#port;
  }

  /** @returns {string} High-level protocol to speak. */
  get protocol() {
    return this.#protocol;
  }

  /** @returns {ServiceUseConfig} Role-to-service configuration. */
  get services() {
    return this.#services;
  }
}
