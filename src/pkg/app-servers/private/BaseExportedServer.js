// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { CertificateManager } from '#p/CertificateManager';
import { ServerManager } from '#p/ServerManager';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';
import { Warehouse } from '#x/Warehouse';

import { Validator } from 'jsonschema';

/**
 * Base class for the exported (public) server classes. Configuration object
 * details:
 *
 * * `{object} host` or `{object[]} hosts` -- Host / certificate configuration.
 *   Required if a server is configured to listen for secure connections.
 * * `{object} server` or `{object[]} servers` -- Server configuration.
 */
export class BaseExportedServer {
  /** {object} Access token for innards. */
  #accessToken;

  /** {ActualServer} Underlying server instance. */
  #actual;

  /**
   * Constructs an instance.
   *
   * @param {Warehouse} warehouse Warehouse of configured pieces.
   */
  constructor(warehouse) {
    const config = warehouse.config;
    BaseExportedServer.#validateConfig(config);
    this.#actual = new ActualServer(warehouse);
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

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const v = new Validator();
    CertificateManager.addConfigSchemaTo(v);
    ServerManager.addConfigSchemaTo(v);

    const schema = {
      allOf: [
        { $ref: '/ServerManager' },
        { $ref: '/OptionalCertificateManager' }
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
