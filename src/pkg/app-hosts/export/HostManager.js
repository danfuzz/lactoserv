// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HostController } from '#x/HostController';

import { TreePathMap } from '@this/collections';
import { JsonSchema, JsonSchemaUtil } from '@this/json';
import { SeeAll } from '@this/see-all';

import { SecureContext } from 'node:tls';


/** @type {function(...*)} Logger for this class. */
const logger = SeeAll.loggerFor('app-hosts');

/**
 * Manager for dealing with all the certificate/key pairs associated with a
 * named host. Configuration object details:
 *
 * * `{object} host` or `{object[]} hosts` -- Objects representing certificate
 *   information associated with one or more (possibly wildcarded) hostnames.
 *
 * Host info details:
 *
 * * `{string} name` or `{string[]} names` -- Names of the hosts associated with
 *   this entry. Names can in the form `*.<name>` to match any subdomain of
 *   `<name>`, or `*` to be a complete wildcard (that is, matches any name not
 *   otherwise mentioned).
 * * `{string} cert` -- Certificate to present, in PEM form.
 * * `{string} key` -- Private key associated with `cert`, in PEM form.
 *
 * **Note:** Exactly one of `host` or `hosts` must be present at the top level.
 * Exactly one of `name` or `names` must be present, per host info element.
 */
export class HostManager {
  /**
   * @type {TreePathMap<HostController>} Map from each componentized hostname to
   * the {@link HostController} object that should be used for it.
   */
  #controllers = new TreePathMap();

  /**
   * Constructs an instance.
   *
   * @param {?object} [config = null] Configuration object. If `null`, this
   *   constructs an empty instance.
   */
  constructor(config = null) {
    if (config !== null) {
      HostManager.#validateConfig(config);

      const hosts =
        JsonSchemaUtil.singularPluralCombo(config.host, config.hosts);
      for (const host of hosts) {
        this.#addControllerFor(host);
      }
    }
  }

  /**
   * @returns {object} Options suitable for use with
   * `http2.createSecureServer()` and the like, such that this instance will be
   * used to find certificates and keys.
   */
  get secureServerOptions() {
    // The `key` and `cert` bound in the result of this getter are for cases
    // when the (network) client doesn't invoke the server-name extension.
    // Hence, it's the wildcard... if available.
    const wildcard = this.findConfig('*') ?? {};

    const sniCallback = (serverName, cb) => this.sniCallback(serverName, cb);

    return { ...wildcard, SNICallback: sniCallback };
  }

  /**
   * Finds the configuration info (cert/key pair) associated with the given
   * hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard.
   * @returns {?{cert: string, key: string}} Configuration info, or `null` if no
   *  hostname match is found.
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
   * Makes an instance with a subset of bindings.
   *
   * @param {string[]} names Hostnames (including wildcards) which are to be
   *   included in the subset.
   * @returns {HostManager} Subsetted instance.
   * @throws {Error} Thrown if any of the `names` isn't bound in this instance.
   */
  makeSubset(names) {
    const result = new HostManager();

    for (const name of names) {
      const key = HostController.parseName(name, true);
      const found = this.#controllers.find(key);

      if (!found) {
        throw new Error(`No binding for hostname: ${name}`);
      }

      result.#controllers.add(key, found.value);
    }

    return result;
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
   * @param {function(?object, ?SecureContext)} callback Callback to present
   *   with the results.
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
      const key = HostController.parseName(name, true);
      logger.binding(name);
      this.#controllers.add(key, controller);
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
    const key = HostController.parseName(name, true);
    const found = this.#controllers.find(key);

    return found ? found.value : null;
  }


  //
  // Static members
  //

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

    const schema = {
      $id: '/HostManager',
      ... JsonSchemaUtil
        .singularOrPlural('host', 'hosts', { $ref: '#/$defs/hostItem' }),

      $defs: {
        hostItem: {
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
          ... JsonSchemaUtil
            .singularOrPlural('name', 'names', { $ref: '#/$defs/hostname' })
        },
        hostname: {
          type: 'string',
          pattern: HostController.HOSTNAME_PATTERN
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
      validator.addSchema(schema);
      validator.addSchema(optionalSchema);
    }
  }

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
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema();
    this.addConfigSchemaTo(validator, true);

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
