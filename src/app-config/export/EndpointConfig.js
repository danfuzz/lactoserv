// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '#x/BaseConfig';
import { Uris } from '#x/Uris';
import { Util } from '#x/Util';


/**
 * Configuration representation for a network endpoint item, that is,
 * identifying information about a network interface, along with hostnames to
 * accept and what protocol to speak. (See {@link ServerConfig}.)
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * `{string|string[]} hostnames` -- Hostnames which this endpoint should
 *   accept as valid. Can include subdomain or complete wildcards. Defaults to
 *   `*` (that is, accepts all hostnames as valid).
 * * `{string} interface` -- Address of the physical interface that the endpoint
 *   is to listen on. `*` indicates that all interfaces should be listened on.
 *   Note: `::` and `0.0.0.0` are not allowed; use `*` instead.
 * * `{int} port` -- Port number that the endpoint is to listen on.
 * * `{string} protocol` -- Protocol that the endpoint is to speak. Must be one
 *   of `http`, `http2`, or `https`.
 */
export class EndpointConfig extends BaseConfig {
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /** @type {string} Address of the physical interface to listen on. */
  #interface;

  /** @type {number} Port to listen on. */
  #port;

  /** @type {string} High-level protocol to speak. */
  #protocol;

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
    } = config;

    this.#hostnames     = Util.checkAndFreezeStrings(hostnames, Uris.HOSTNAME_PATTERN);
    this.#interface     = Uris.checkInterface(iface);
    this.#port          = Uris.checkPort(port);
    this.#protocol      = Uris.checkProtocol(protocol);
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

  /** @returns {number} Port to listen on. */
  get port() {
    return this.#port;
  }

  /** @returns {string} High-level protocol to speak. */
  get protocol() {
    return this.#protocol;
  }
}
