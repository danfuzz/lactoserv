// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HostController } from '#p/HostController';

import { JsonSchema } from '@this/typey';

// Types referenced only in doc comments.
import { SecureContext } from 'node:tls';

/**
 * Manager for dealing with all the certificate/key pairs associated with a
 * named host. Configuration object details:
 *
 * * `{object} host` -- Object representing certificate information associated
 *   with an indicated (possibly wildcarded) hostname.
 * * `{object[]} hosts` -- Array of host information objects.
 *
 * Host info details:
 *
 * * `{string} name` -- Name of the host associated with this entry. Can be in
 *   the form `*.<name>` to match any subdomain of `<name>`, or `*` to be a
 *   complete wildcard (that is, matches any name not otherwise mentioned).
 * * `{string[]} names` -- Array of names, each in the same format as specified
 *   by `name`. This can be used to bind multiple names to the same certificate
 *   info.
 * * `{string} cert` -- Certificate to present, in PEM form.
 * * `{string} key` -- Private key associated with `cert`, in PEM form.
 *
 * **Note:** Exactly one of `host` or `hosts` must be present at the top level.
 * Exactly one of `name` or `names` must be present, per host info element.
 */
export class HostManager {
  /**
   * {Map<string, HostController>} Map from each hostname / wildcard to the
   * {@link HostController} object that should be used for it.
   */
  #controllers = new Map();

  /**
   * Constructs and returns an instance from the given configuration, or returns
   * `null` if the configuration doesn't need any secure contexts.
   *
   * @param {object} config Configuration object.
   * @returns {?HostManager} An appropriately-constructed instance, or `null` if
   *   none is configured.
   */
  static fromConfig(config) {
    if (!(config.hosts || config.host)) {
      return null;
    }

    return new HostManager(config);
  }

  /**
   * Adds the config schema for this class to the given validator.
   *
   * @param {JsonSchema} validator The validator to add to.
   * @param {boolean} [main = false] Is this the main schema?
   */
  static addConfigSchemaTo(validator, main = false) {
    const base64Line = '[/+a-zA-Z0-9]{0,80}';
    const pemLines = `(${base64Line}\n){1,500}${base64Line}={0,2}\n`;

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

    // Allows regular dotted names, a regular name prefixed with a wildcard
    // (`*.<name>`), or just a wildcard (`*`). Note that name components must
    // not start or end with a dash.
    const simpleName = '(?!-)[-a-zA-Z0-9]+(?<!-)';
    const hostNamePattern =
      '^(' +
      '[*]' +
      `|([*][.])?(${simpleName}[.])*${simpleName}` +
      ')$';

    const schema = {
      $id: '/HostManager',
      oneOf: [
        {
          title: 'host',
          type: 'object',
          required: ['host'],
          properties: {
            host: { $ref: '#/$defs/hostItem' }
          }
        },
        {
          title: 'hosts',
          type: 'object',
          required: ['hosts'],
          properties: {
            hosts: {
              type: 'array',
              uniqueItems: true,
              items: { $ref: '#/$defs/hostItem' }
            }
          }
        }
      ],

      $defs: {
        hostItem: {
          title: 'host-info',
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
          },
          oneOf: [
            {
              title: 'name',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  pattern: hostNamePattern
                  //$ref: '#/$defs/hostName'
                }
              }
            },
            {
              title: 'names',
              required: ['names'],
              properties: {
                names: {
                  type: 'array',
                  uniqueItems: true,
                  items: { $ref: '#/$defs/hostName' }
                }
              }
            }
          ]
        },
        hostName: {
          type: 'string',
          pattern: hostNamePattern
        }
      }
    };

    const optionalSchema = {
      $id: '/OptionalHostManager',
      if: {
        anyOf: [
          {
            type: 'object',
            required: ['host']
          },
          {
            type: 'object',
            required: ['hosts']
          }
        ]
      },
      then: { $ref: '/HostManager' }
    };

    if (main) {
      validator.addMainSchema(schema);
    } else {
      // TODO: Remove the second argument.
      validator.addSchema(schema, '/HostManager');
      validator.addSchema(optionalSchema, '/OptionalHostManager');
    }
  }

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    HostManager.#validateConfig(config);

    if (config.host) {
      this.#addControllerFor(config.host);
    }

    if (config.hosts) {
      for (const host of config.hosts) {
        this.#addControllerFor(host);
      }
    }
  }

  /**
   * Finds the configuration info (cert/key pair) associated with the given
   * hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard.
   * @returns {?{cert: string, key: string}} Object mapping `cert` and `key`; or
   *  `null` if no hostname match is found.
   */
  findConfig(name) {
    const controller = this.#findController(name);

    if (!controller) {
      return null;
    }

    return {
      cert: controller.cert,
      key:  controller.key
    };
  }

  /**
   * Finds the TLS {@link SecureContext} to use, based on the given hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard.
   * @returns {?SecureContext} The associated {@link SecureContext}, or `null`
   *   if no hostname match is found.
   */
  findContext(name) {
    const controller = this.#findController(name);
    return controller ? controller.secureContext : null;
  }

  /**
   * Wrapper for {@link #findContext} in the exact form that is expected as an
   * `SNICallback` configured in the options of a call to (something like)
   * `http2.createSecureServer()`.
   *
   * See <https://nodejs.org/dist/latest-v18.x/docs/api/tls.html#tlscreateserveroptions-secureconnectionlistener>
   * for details.
   *
   * @param {string} serverName Name of the server to find, or `*` to
   *   explicitly request the wildcard / fallback certificate.
   * @param {Function} callback Callback to present with the results.
   */
  sniCallback(serverName, callback) {
    try {
      callback(null, this.findContext(serverName));
    } catch (e) {
      callback(e, null);
    }
  }

  /**
   * Constructs a {@link HostController} based on the given information, and
   * adds mappings to {@link #controllers} so it can be found.
   *
   * @param {object} hostItem Single host item from a configuration object.
   */
  #addControllerFor(hostItem) {
    const controller = new HostController(hostItem);

    for (const name of controller.names) {
      console.log(`Binding hostname ${name}.`);
      if (this.#controllers.has(name)) {
        throw new Error(`Duplicate hostname: ${name}`);
      }
      this.#controllers.set(name, controller);
    }
  }

  /**
   * Finds the most-specific {@link HostController} for a given hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard.
   * @returns {?HostController} The associated controller, or `null` if nothing
   *   suitable is found.
   */
  #findController(name) {
    for (;;) {
      const controller = this.#controllers.get(name);
      if (controller) {
        return controller;
      }

      if (name === '*') {
        // We just failed to find a wildcard match.
        return null;
      }

      // Strip off the leading wildcard (if any) and first name component, and
      // add a wildcard back on.
      const newName = name.replace(/^([*][.])?[^.]+([.]|$)/, '*.');
      if ((name === newName) || (newName === '*.')) {
        // `name === newName` avoids an infinite loop when the original `name`
        // is either undotted or not in the expected/valid syntax.
        name = '*';
      } else {
        name = newName;
      }
    }
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema();
    this.addConfigSchemaTo(validator, true);

    const error = validator.validate(config);

    if (error) {
      error.log(console);
      error.throwError();
    }
  }
}
