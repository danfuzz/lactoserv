// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { SecureContext } from 'node:tls';

import { HostConfig, Uris } from '@this/app-config';
import { TreePathMap } from '@this/collections';

import { HostController } from '#x/HostController';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the host bindings. "Hosts" in this sense are
 * network-available servers associated with particular names, certificates, and
 * private keys.
 */
export class HostManager {
  /**
   * @type {TreePathMap<HostController>} Map from each componentized hostname to
   * the {@link HostController} object that should be used for it.
   */
  #controllers = new TreePathMap();

  /** @type {function(...*)} Logger for this class. */
  #logger = ThisModule.logger.hosts;

  /**
   * Constructs an instance.
   *
   * @param {HostConfig[]} [configs = []] Configuration objects.
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
   * Makes an instance with the given subset of bindings. Wildcard hostnames
   * in `names` are matched as wildcards with the existing bindings, so, for
   * example, passing a complete wildcard hostname will produce a clone of this
   * instance.
   *
   * @param {string[]} names Hostnames (including wildcards) which are to be
   *   included in the subset.
   * @returns {HostManager} Subsetted instance.
   * @throws {Error} Thrown if any of the `names` is found not to match any
   *   bindings in this instance.
   */
  makeSubset(names) {
    const result = new HostManager();

    for (const name of names) {
      const key   = Uris.parseHostname(name, true);
      const found = this.#controllers.findSubtree(key);
      if (found.size === 0) {
        throw new Error(`No bindings found for hostname: ${name}`);
      }
      for (const [k, v] of found) {
        // Avoid trying to add duplicates (which would fail).
        if (result.#controllers.get(k) === null) {
          result.#controllers.add(k, v);
        }
      }
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
   * @param {HostConfig} hostItem Parsed configuration item.
   */
  #addControllerFor(hostItem) {
    const controller = new HostController(hostItem);

    for (const name of controller.config.hostnames) {
      const key = Uris.parseHostname(name, true);
      this.#controllers.add(key, controller);
      this.#logger.bound(name);
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
