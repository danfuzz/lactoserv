// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationManager } from '#p/ApplicationManager';
import { HostManager } from '#p/HostManager';
import { ServerManager } from '#p/ServerManager';

import { JsonSchema } from '@this/typey';

// Types referenced only in doc comments.
import { ServerController } from '#p/ServerController';

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
    this.#serverManager = new ServerManager(config, this.#hostManager);
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
   * Creates a server for a single app. TODO: This is scaffolding for the
   * transition from single- to multi-app support.
   *
   * @param {string} appName Name of the application to serve.
   * @param {string} serverName Name of the server to serve from.
   * @returns {ServerController} Appropriately-constructed instance.
   */
  makeSingleApplicationServer(appName, serverName) {
    const serverController = this.#serverManager.findController(serverName);

    this.#applicationManager.makeSingleApplicationServer(
      appName, serverController);

    return serverController;
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
      error.log(console);
      error.throwError();
    }
  }
}
