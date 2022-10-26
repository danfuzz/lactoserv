// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { SecureContext } from 'node:tls';

import { HostItem, Uris } from '@this/app-config';
import { TreePathMap } from '@this/collections';
import { Loggy } from '@this/loggy';

import { HostController } from '#x/HostController';


/** @type {function(...*)} Logger for this class. */
const logger = Loggy.loggerFor('app-hosts');

/**
 * Manager for dealing with all the certificate/key pairs associated with a
 * set of named hosts.
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
   * @param {HostItem[]} [configs = []] Configuration objects.
   */
  constructor(configs = []) {
    for (const config of configs) {
      this.#addControllerFor(config);
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
   * hostname. The return value is suitable for use in options passed to Node
   * `TLS` functions / methods.
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

    return Object.freeze({
      cert: controller.config.certificate,
      key:  controller.config.privateKey
    });
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
      const key = Uris.parseHostname(name, true);
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
   * @param {HostItem} hostItem Parsed configuration item.
   */
  #addControllerFor(hostItem) {
    const controller = new HostController(hostItem);

    for (const name of controller.config.hostnames) {
      const key = Uris.parseHostname(name, true);
      this.#controllers.add(key, controller);
      logger.bound(name);
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
    const key   = Uris.parseHostname(name, true);
    const found = this.#controllers.find(key);

    return found ? found.value : null;
  }
}
