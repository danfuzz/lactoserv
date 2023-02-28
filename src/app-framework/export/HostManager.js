// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SecureContext } from 'node:tls';

import { HostConfig, Uris } from '@this/app-config';
import { TreePathKey, TreePathMap } from '@this/collections';
import { IntfLogger } from '@this/loggy';

import { HostItem } from '#p/HostItem';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the hostname bindings. "Hosts" in this sense are
 * network-available endpoints associated with particular names, certificates,
 * and private keys. The main thing offered by this class is the association
 * between hostnames and TLS contexts.
 */
export class HostManager {
  /**
   * @type {TreePathMap<HostItem>} Map from each componentized hostname to
   * the {@link HostItem} that should be used for it.
   */
  #items = new TreePathMap(TreePathKey.hostnameStringFrom);

  /**
   * @type {?IntfLogger} Logger for this class, or `null` not to do any
   * logging.
   */
  #logger = ThisModule.logger.hosts;

  /**
   * Constructs an instance.
   *
   * @param {HostConfig[]} [configs = []] Configuration objects.
   */
  constructor(configs = []) {
    for (const config of configs) {
      this.#addItemFor(config);
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
    const item = this.#findItem(name);

    if (!item) {
      return null;
    }

    return Object.freeze({
      cert: item.config.certificate,
      key:  item.config.privateKey
    });
  }

  /**
   * Finds the TLS {@link SecureContext} to use, based on the given hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard. `*` to explicitly request the wildcard / fallback context.
   * @returns {?SecureContext} The associated {@link SecureContext}, or `null`
   *   if no hostname match is found.
   */
  findContext(name) {
    const item = this.#findItem(name);
    return item ? item.secureContext : null;
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
      const found = this.#items.findSubtree(key);
      if (found.size === 0) {
        throw new Error(`No bindings found for hostname: ${name}`);
      }
      for (const [k, v] of found) {
        // Avoid trying to add duplicates (which would fail).
        if (result.#items.get(k) === null) {
          result.#items.add(k, v);
        }
      }
    }

    return result;
  }

  /**
   * Like {@link #findContext}, except in the exact form that is expected as an
   * `SNICallback` configured in the options of a call to (something like)
   * `http2.createSecureServer()`.
   *
   * See <https://nodejs.org/dist/latest-v18.x/docs/api/tls.html#tlscreateserveroptions-secureconnectionlistener>
   * for details.
   *
   * @param {string} serverName Name of the server to find, or `*` to
   *   explicitly request the wildcard / fallback context.
   * @param {function(?object, ?SecureContext)} callback Callback to present
   *   with the results.
   */
  sniCallback(serverName, callback) {
    const found    = this.#findItem(serverName);
    let   foundCtx = null;

    if (found) {
      this.#logger.foundMatchFor(serverName, found.config.hostnames);
      foundCtx = found.secureContext;
    } else {
      this.#logger.noMatchFor(serverName);
    }

    try {
      callback(null, foundCtx);
    } catch (e) {
      this.#logger.errorDuringCallback(e);
      callback(e, null);
    }
  }

  /**
   * Constructs a {@link HostItem} based on the given information, and adds
   * mappings to {@link #items} so it can be found.
   *
   * @param {HostConfig} hostItem Parsed configuration item.
   */
  #addItemFor(hostItem) {
    const item = new HostItem(hostItem);

    for (const name of item.config.hostnames) {
      const key = Uris.parseHostname(name, true);
      this.#items.add(key, item);
      this.#logger.bound(name);
    }
  }

  /**
   * Finds the most-specific {@link HostItem} for a given hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard.
   * @returns {?HostItem} The associated item, or `null` if nothing suitable is
   *   found.
   */
  #findItem(name) {
    const key   = Uris.parseHostname(name, true);
    const found = this.#items.find(key);

    return found ? found.value : null;
  }
}
