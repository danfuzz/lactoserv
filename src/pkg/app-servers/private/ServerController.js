// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { WranglerFactory } from '#p/WranglerFactory';

/**
 * "Controller" for a single server.
 */
export class ServerController {
  /** {string} Server name. */
  #name;

  /** {string} Interface address. */
  #interface;

  /** {int} Port number. */
  #port;

  /** {string} Protocol. */
  #protocol;

  /** {BaseWrangler} Protocol-specific "wrangler." */
  #wrangler;

  /**
   * Constructs an insance.
   *
   * @param {object} serverConfig Server information configuration item.
   */
  constructor(serverConfig) {
    this.#name      = serverConfig.name;
    this.#interface = serverConfig.interface;
    this.#port      = serverConfig.port;
    this.#protocol  = serverConfig.protocol;
    this.#wrangler  = WranglerFactory.forProtocol(this.#protocol);
  }

  /** {object} Plain object which recapitulates the original configuration. */
  get configObject() {
    return {
      name:      this.#name,
      interface: this.#interface,
      port:      this.#port,
      protocol:  this.#protocol
    }
  }

  /** {string} Interface address. */
  get interface() {
    return this.#interface;
  }

  /** {string} Server name. */
  get name() {
    return this.#name;
  }

  /** {int} Port number. */
  get port() {
    return this.#port;
  }

  /** {string} Protocol. */
  get protocol() {
    return this.#protocol;
  }

  /** {BaseWrangler} The protocol wrangler. */
  get wrangler() {
    return this.#wrangler;
  }
}
