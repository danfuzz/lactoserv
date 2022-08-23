// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as tls from 'node:tls';

/**
 * Manager for dealing with all the certificate/key pairs used by a server.
 */
export class CertificateManager {
  /** {object} Configuration object. */
  #config;

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
    if ((config.cert === null) || (config.key === null)) {
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
  }

  /**
   * Finds the cert/key pair associated with the given server name, or `*` to
   * indicate the wildcard / fallback certificate.
   *
   * @param {string} serverName Name of the server to find, or `*` to explicitly
   *   request the wildcard / fallback certificate.
   */
  findInfo(serverName) {
    if (serverName === '*') {
      console.log('Need wildcard info.');
    } else {
      console.log(`Need info for: ${serverName}`);
    }

    // For, now, just use the single cert entry from the configuration. TODO:
    // Extend this to be able to find host-specific configs.
    serverName = '*';

    if (serverName === '*') {
      const config = this.#config;
      return {
        cert: config.cert,
        key:  config.key
      }
    } else {
      // TODO!
      throw new Error('TODO');
    }
  }

  /**
   * Figures out which cert/key to use, based on the server name as provided by
   * the client. This is meant to be called within the `SNICallback` set up in
   * the server options in a call to (something like)
   * `http2.createSecureServer()`.
   *
   * See <https://nodejs.org/dist/latest-v18.x/docs/api/tls.html#tlscreateserveroptions-secureconnectionlistener>
   * for details.
   *
   * @param {string} serverName Name of the server to find, or `*` to
   *   explicitly request the wildcard / fallback certificate.
   */
  findContext(serverName) {
    if (serverName === '*') {
      console.log('Need wildcard context.');
    } else {
      console.log(`Need context for: ${serverName}`);
    }

    // For, now, just use the single cert entry from the configuration. TODO:
    // Extend this to be able to find host-specific configs.
    serverName = '*';

    if (serverName === '*') {
      if (this.#wildcardSecureContext === null) {
        const config = this.#config;
        this.#wildcardSecureContext = tls.createSecureContext({
          cert: config.cert,
          key:  config.key
        });
      }

      return this.#wildcardSecureContext;
    } else {
      throw new Error('TODO');
    }
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
}
