// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';

import { Validator } from 'jsonschema';

/**
 * Base class for the exported (public) server classes. Configuration object
 * details:
 *
 * * `{string} protocol` -- Name of the protocol to answer to. One of `http`,
 *   `http2`, or `https`.
 * * `{string} interface` -- Name/address of the interface to listen on. `::` to
 *   listen on all interfaces.
 * * `{int} port` -- Port number to listen on.
 *
 * Additional configuration for `http2` and `https`:
 * * `{string} cert` -- Certificate to present.
 * * `{string} key` -- Private key associated with `cert`.
 */
export class BaseExportedServer {
  /** {object} Access token for innards. */
  #accessToken;

  /** {ActualServer} Underlying server instance. */
  #actual;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    BaseExportedServer.#validateConfig(config);
    this.#actual = new ActualServer(config);
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

    const base64Line = '[/+a-zA-Z0-9]{0,80}';
    const pemLines = `(${base64Line}\n){1,500}${base64Line}={0,3}\n`;
    const certPattern =
      '^\n*' +
      '-----BEGIN CERTIFICATE-----\n' +
      pemLines +
      '-----END CERTIFICATE-----' +
      '\n*$';
    const keyPattern =
      '^\n*' +
      '-----BEGIN PRIVATE KEY-----\n' +
      pemLines +
      '-----END PRIVATE KEY-----' +
      '\n*$';

    // See <https://json-schema.org/>.
    const schema = {
      allOf: [
        {
          title: 'server-core',
          type: 'object',
          required: ['protocol', 'interface', 'port'],
          properties: {
            protocol: {
              type: 'string',
              enum: ['http', 'http2', 'https']
            },
            interface: {
              type: 'string'
            },
            port: {
              type: 'integer',
              minimum: 1,
              maximum: 65535
            }
          },
        },
        {
          title: 'secure-server',
          if: {
            type: 'object',
            properties: {
              protocol: {
                type: 'string',
                enum: ['http2', 'https']
              }
            }
          },
          then: {
            type: 'object',
            required: ['cert', 'key'],
            properties: {
              cert: {
                type: 'string',
                pattern: certPattern
              },
              key: {
                type: 'string',
                pattern: keyPattern
              }
            }
          }
        }
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
