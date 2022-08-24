// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as tls from 'node:tls';

import { Validator } from 'jsonschema';

/**
 * Manager for dealing with all the certificate/key pairs used by a server.
 * Configuration object details:
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
export class CertificateManager {
  /** {object} Configuration object. */
  #config;

  /** {Map<string, CertInfo} Map from each hostname / wildcard to the
   * {@link CertInfo} object that should be used for it. */
  #infos = new Map();

  /** {Map<string, SecureContext>} Map from each hostname to the TLS secure
   * context that it should use. Lazily initialized. */
  #secureContexts = new Map();

  /** {SecureContext|null} "Wildcard" TLS context, to use when no specific
   * hostname binding is available. */
  #wildcardSecureContext = null;

  /**
   * Constructs and returns an instance from the given configuration, or returns
   * `null` if the configuration doesn't need any secure contexts.
   *
   * @param {object} config Configuration object.
   * @returns {CertificateManager|null} An appropriately-constructed instance,
   *   or `null` if none is required.
   */
  static fromConfig(config) {
    if (!config.hosts) {
      return null;
    }

    return new CertificateManager(config);
  }

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    this.#config = config;

    CertificateManager.#validateConfig(config);

    if (config.host) {
      this.#addInfoFor(config.host);
    }

    if (config.hosts) {
      for (const host of config.hosts) {
        this.#addInfoFor(host);
      }
    }
  }

  /**
   * Finds the cert/key pair associated with the given host name.
   *
   * @param {string} name Host name to look for, which may be a partial or full
   *   wildcard.
   * @returns {object|null} Object mapping `cert` and `key`; or `null` if no
   *   host name match is found.
   */
  findInfo(name) {
    const info = this.#findInfo(name);

    if (!info) {
      return null;
    }

    return {
      cert: info.cert,
      key:  info.key
    }
  }

  /**
   * Finds the TLS {@link SecureContext} to use, based on the given host name.
   *
   * @param {string} name Host name to look for, which may be a partial or full
   *   wildcard.
   * @returns {SecureContext|null} The associated {@link SecureContext}, or
   *   `null` if no host name match is found.
   */
  findContext(name) {
    const info = this.#findInfo(name);
    return info ? info.secureContext : null;
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
   * @param {function} callback Callback to present with the results.
  */
  sniCallback(serverName, callback) {
    try {
      callback(null, this.findContext(serverName));
    } catch (e) {
      callback(e, null);
    }
  }

  /**
   * Constructs a {@link CertInfo} based on the given information, and adds
   * mappings to {@link #infos} so it can be found.
   *
   * @param {object} hostItem Single host item from a configuration object.
   */
  #addInfoFor(hostItem) {
    const info = new CertInfo(hostItem);

    for (const name of info.names) {
      console.log(`Binding ${name}.`);
      if (this.#infos.has(name)) {
        throw new Error(`Duplicate hostname: ${name}`);
      }
      this.#infos.set(name, info);
    }
  }

  /**
   * Finds the most-specific {@link CertInfo} for a given host name.
   *
   * @param {string} name Host name to look for, which may be a partial or full
   *   wildcard.
   * @returns {CertInfo|null} The associated information, or `null` if nothing
   *   suitable is found.
   */
  #findInfo(name) {
    for (;;) {
      const info = this.#infos.get(name);
      if (info) {
        return info;
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
    const v = new Validator();
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
    // (`*.<name>`), or just a wildcard (`*`).
    const simpleName = '(?!-)[-a-zA-Z0-9]+(?<!-)';
    const hostNamePattern =
      '^' +
      '[*]|' +
      `([*][.])?(${simpleName}[.])*${simpleName}`
      '$';

    const schema = {
      title: 'certificate-info',
      allOf: [
        {
          // Can't have both `host` and `hosts`.
          not: {
            type: 'object',
            required: ['host', 'hosts']
          }
        },
        {
          oneOf: [
            {
              type: 'object',
              properties: {
                host: { $ref: '#/$defs/hostItem' }
              }
            },
            {
              type: 'object',
              properties: {
                hosts: {
                  type: 'array',
                  uniqueItems: true,
                  items: { $ref: '#/$defs/hostItem' }
                }
              }
            }
          ]
        }
      ],

      $defs: {
        hostItem: {
          allOf: [
            {
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
            },
            {
              // Can't have both `name` and `names`.
              not: {
                type: 'object',
                required: ['name', 'names']
              }
            },
            {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    name: { $ref: '#/$defs/hostName' }
                  }
                },
                {
                  type: 'object',
                  properties: {
                    names: {
                      type: 'array',
                      uniqueItems: true,
                      items: { $ref: '#/$defs/hostName' }
                    }
                  }
                }
              ]
            }
          ]
        },
        hostName: {
          type: 'string',
          pattern: hostNamePattern
        }
      }
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

/**
 * Holder for a single set of certificate information.
 */
class CertInfo {
  /** {string[]} List of hostnames, including partial or full wildcards. */
  #names;

  /** {string} Certificate, in PEM form. */
  #cert;

  /** {string} Key, in PEM form. */
  #key;

  /** {SecureContext} TLS context representing this instance's info. */
  #secureContext;

  /**
   * Constructs an insance.
   *
   * @param {object} hostConfig Element of a `hosts` array from a configuration
   * object.
   */
  constructor(hostConfig) {
    const nameArray = hostConfig.name ? [hostConfig.name] : [];
    const namesArray = hostConfig.names ?? [];
    this.#names = [...nameArray, ...namesArray];

    this.#cert = hostConfig.cert;
    this.#key = hostConfig.key;

    this.#secureContext = tls.createSecureContext({
      cert: this.#cert,
      key:  this.#key
    });
  }

  /** {string[]} List of hostnames, including partial or full wildcards. */
  get names() {
    return this.#names;
  }

  /** {string} Certificate, in PEM form. */
  get cert() {
    return this.#cert;
  }

  /** {string} Key, in PEM form. */
  get key() {
    return this.#key;
  }

  /** {SecureContext} TLS context representing this instance's info. */
  get secureContext() {
      return this.#secureContext;
  }
}
