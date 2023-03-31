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
 * * `{string|string[]} hostnames` -- Hostnames which this endpoint should
 *   accept as valid. Can include subdomain or complete wildcards. Defaults to
 *   `*` (that is, accepts all hostnames as valid).
 * * `{string} interface` -- Physical interface that the endpoint is to listen
 *   on. Must be an object of a form suitable for parsing by {@link
 *   Uris#parseInterface}.
 * * `{string} protocol` -- Protocol that the endpoint is to speak. Must be one
 *   of `http`, `http2`, or `https`.
 * * `{object[]} mounts` -- Array of application mounts, each of a form suitable
 *   for passing to the {@link MountConfig} constructor.
 * * `{object} services` -- Mapping of service roles to the names of services
 *   which are to fill those roles, suitable for passing to the {@link
 *   ServiceUseConfig} constructor.
 */
export class EndpointConfig extends NamedConfig {
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /**
   * @type {object} Physical interface to listen on; this is the result of a
   * call to {@link Uris#parseInterface}.
   */
  #interface;

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
      mounts,
      protocol,
      services = {}
    } = config;

    this.#hostnames = Util.checkAndFreezeStrings(hostnames, Uris.HOSTNAME_PATTERN);
    this.#interface = Object.freeze(Uris.parseInterface(iface));
    this.#mounts    = MountConfig.parseArray(mounts);
    this.#protocol  = Uris.checkProtocol(protocol);
    this.#services  = new ServiceUseConfig(services);
  }

  /**
   * @returns {string[]} List of hostnames, including possibly subdomain and/or
   * full wildcards.
   */
  get hostnames() {
    return this.#hostnames;
  }

  /**
   * @returns {object} Parsed interface. This is a frozen return value from
   * {@link Uris#parseInterface}.
   */
  get interface() {
    return this.#interface;
  }

  /** @returns {MountConfig[]} Array of application mounts. */
  get mounts() {
    return this.#mounts;
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
