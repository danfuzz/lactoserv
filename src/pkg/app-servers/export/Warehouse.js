// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationManager } from '#p/ApplicationManager';
import { HostManager } from '#p/HostManager';
import { ServerManager } from '#p/ServerManager';

import { JsonSchema } from '@this/json';

/**
 * "Warehouse" of bits and pieces created from a top-level configuration.
 *
 * Configuration object details:
 *
 * * `{object} host` or `{object[]} hosts` -- Host / certificate configuration.
 *   Required if a server is configured to listen for secure connections.
 * * `{object} server` or `{object[]} servers` -- Server configuration.
 * * `{object} app` or `{object[]} apps` -- Application configuration.
 */
export class Warehouse {
  /** @type {ApplicationManager} Application manager. */
  #applicationManager;

  /** @type {?HostManager} Host manager, if configured. */
  #hostManager;

  /** @type {ServerManager} Server manager, for all server bindings. */
  #serverManager;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    Warehouse.#validateConfig(config);

    this.#hostManager = HostManager.fromConfig(config);
    this.#applicationManager = new ApplicationManager(config);
    this.#serverManager =
      new ServerManager(config, this.#hostManager, this.#applicationManager);
  }

  /** @returns {ApplicationManager} Application manager. */
  get applicationManager() {
    return this.#applicationManager;
  }

  /**
   * @returns {?HostManager} Host manager secure contexts, if needed. Can be
   * `null` * if all servers are insecure.
   */
  get hostManager() {
    return this.#hostManager;
  }

  /** @returns {ServerManager} Server manager, for all server bindings. */
  get serverManager() {
    return this.#serverManager;
  }

  /**
   * Starts all servers. This async-returns once all servers are started.
   *
   * @throws {Error} Thrown if any server had trouble starting.
   */
  async startAllServers() {
    const servers = this.#serverManager.getAll();
    const results = servers.map(s => s.start());

    return Promise.all(results);
  }

  /**
   * Stops all servers. This async-returns once all servers are stopped.
   *
   * @throws {Error} Thrown if any server had trouble stopping.
   */
  async stopAllServers() {
    const servers = this.#serverManager.getAll();
    const results = servers.map(s => s.stop());

    return Promise.all(results);
  }

  /**
   * Returns a promise that becomes fulfilled when all servers are stopped.
   */
  async whenAllServersStopped() {
    const servers = this.#serverManager.getAll();
    const results = servers.map(s => s.whenStopped());

    return Promise.all(results);
  }


  //
  // Static members
  //

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema('LactoServ Configuration');
    ApplicationManager.addConfigSchemaTo(validator);
    HostManager.addConfigSchemaTo(validator);
    ServerManager.addConfigSchemaTo(validator);

    validator.addMainSchema({
      $id: '/Warehouse',
      allOf: [
        { $ref: '/ApplicationManager' },
        { $ref: '/OptionalHostManager' },
        { $ref: '/ServerManager' }
      ]
    });

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
