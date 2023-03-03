// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '#x/BaseConfig';
import { Uris } from '#x/Uris';


/**
 * Configuration representation for a network interface, that is, the thing that
 * knows of a specific "place" which can receive connections.
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * `{string} address` -- Address of the physical interface that the endpoint
 *   is to listen on. `*` indicates that all interfaces should be listened on.
 *   Note: `::` and `0.0.0.0` are not allowed; use `*` instead.
 * * `{int} port` -- Port number that the endpoint is to listen on.
 */
export class InterfaceConfig extends BaseConfig {
  /** @type {string} Address of the physical interface to listen on. */
  #address;

  /** @type {number} Port to listen on. */
  #port;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const { address, port } = config;

    this.#address = Uris.checkInterfaceAddress(address);
    this.#port    = Uris.checkPort(port);
  }

  /** @returns {string} Address of the physical interface to listen on. */
  get address() {
    return this.#address;
  }

  /** @returns {number} Port to listen on. */
  get port() {
    return this.#port;
  }
}
