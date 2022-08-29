// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationManager } from '#p/ApplicationManager';
import { HostManager } from '#p/HostManager';
import { ServerManager } from '#p/ServerManager';

import { Validator } from 'jsonschema';

// Types referenced in doc comments.
/** @typedef {object} BaseApplication */

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
  /** {object} Configuration object. */
  #config;

  /** {ApplicationManager} Application manager. */
  #applicationManager;

  /** {?HostManager} Host manager, if configured. */
  #hostManager;

  /** {ServerManager} Server manager, for all server bindings. */
  #serverManager;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    Warehouse.#validateConfig(config);

    this.#config = config;
    this.#hostManager = HostManager.fromConfig(config);
    this.#serverManager = new ServerManager(config, this.#hostManager);
    this.#applicationManager = new ApplicationManager(config);
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

  /**
   * @returns {object} The original configuration object. TODO: This shouldn't
   * be exposed.
   */
  get config() {
    return this.#config;
  }

  /** @returns {ServerManager} Server manager, for all server bindings. */
  get serverManager() {
    return this.#serverManager;
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const v = new Validator();
    ApplicationManager.addConfigSchemaTo(v);
    HostManager.addConfigSchemaTo(v);
    ServerManager.addConfigSchemaTo(v);

    const schema = {
      allOf: [
        { $ref: '/ApplicationManager' },
        { $ref: '/OptionalHostManager' },
        { $ref: '/ServerManager' }
      ]
    };

    const result = v.validate(config, schema);
    const errors = result.errors;

    if (errors.length !== 0) {
      console.log('Configuration error%s:', (errors.length === 1) ? '' : 's');
      for (const e of errors) {
        console.log('  %s', e.stack);
      }

      throw new Error('Invalid configuration.');
    }
  }

  /**
   * Creates a server for a single app. TODO: This is scaffolding for the
   * transition from single- to multi-app support.
   *
   * @param {string} name Name of the application to serve.
   * @returns {BaseApplication} Appropriately-constructed instance.
   */
  makeSingleApplicationServer(name) {
    return this.#applicationManager.makeSingleApplicationServer(name, this);
  }
}
