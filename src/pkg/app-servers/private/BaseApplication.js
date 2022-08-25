// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { ServerManager } from '#p/ServerManager';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';
import { Warehouse } from '#x/Warehouse';

import { Validator } from 'jsonschema';

/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication {
  /** {object} Access token for innards. */
  #accessToken;

  /** {ApplicationInfo} Application info. */
  #info;

  /** {ActualServer} Underlying server instance. */
  #actual;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationInfo} info Configured application info.
   * @param {Warehouse} warehouse Warehouse of configured pieces.
   */
  constructor(info, warehouse) {
    this.#info = info;

    const mounts = info.mounts;
    if (mounts.length !== 1) {
      throw new Error(`No unique mount for application: ${info.name}`);
    }
    const serverName = mounts[0].server;
    const serverConfig = warehouse.serverManager.findConfig(serverName);

    if (mounts[0].path !== '/') {
      throw new Error(`Only top-level mounts for now, not: ${mounts[0].path}`);
    }

    this.#actual = new ActualServer(warehouse.hostManager, serverConfig);
  }

  /**
   * Gets the internal `ActualServer` instance, but only if this method is
   * presented with the designated protected-access token.
   *
   * @param {object} accessToken Access token.
   * @returns {ActualServer} Underlying server instance.
   */
  getActual(accessToken) {
    if (accessToken !== PROTECTED_ACCESS) {
      throw new Error('Access token mismatch.');
    }

    return this.#actual;
  }

  /**
   * Starts the server.
   */
  async start() {
    await this.#actual.start();
  }

  /**
   * Stops the server.
   */
  async stop() {
    return this.#actual.stop();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    return this.#actual.whenStopped();
  }
}
