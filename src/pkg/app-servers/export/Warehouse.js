// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationManager } from '#p/ApplicationManager';
import { HostManager } from '#p/HostManager';
import { ServerManager } from '#p/ServerManager';

import { Validator } from 'jsonschema';

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

  /** {HostManager|null} Host manager, if configured. */
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
    this.#applicationManager = new ApplicationManager(config);
    this.#serverManager = new ServerManager(config);
    this.#hostManager = HostManager.fromConfig(config);
  }

  /** {ApplicationManager} Application manager. */
  get applicationManager() {
    return this.#applicationManager;
  }

  /** {HostManager|null} Host manager secure contexts, if needed. Can be `null`
   * if all servers are insecure. */
  get hostManager() {
    return this.#hostManager;
  }

  /** {object} The original configuration object. TODO: This shouldn't be
   * exposed. */
  get config() {
    return this.#config;
  }

  /** {ServerManager} Server manager, for all server bindings. */
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

    if (errors.length != 0) {
      console.log('Configuration error%s:', (errors.length == 1) ? '' : 's');
      for (const e of errors) {
        console.log('  %s', e.stack);
      }

      throw new Error('Invalid configuration.');
    }
  }
}
