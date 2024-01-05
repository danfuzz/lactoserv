// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SecureContext } from 'node:tls';

import { HostConfig } from '@this/app-config';
import { TreePathKey, TreePathMap } from '@this/collections';
import { IntfLogger } from '@this/loggy';
import { Uris } from '@this/net-util';
import { IntfHostManager } from '@this/network-protocol';

import { HostItem } from '#p/HostItem';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the hostname bindings. "Hosts" in this sense are
 * network-available endpoints associated with particular names, certificates,
 * and private keys. The main thing offered by this class is the association
 * between hostnames and TLS contexts.
 *
 * @implements {IntfHostManager}
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
   * @param {HostConfig[]} [configs] Configuration objects.
   */
  constructor(configs = []) {
    for (const config of configs) {
      this.#addItemFor(config);
    }
  }

  /** @override */
  async findContext(name) {
    const item = this.#findItem(name, true);
    return item ? await item.getSecureContext() : null;
  }

  /** @override */
  async getSecureServerOptions() {
    const result = {
      SNICallback: (serverName, cb) => this.sniCallback(serverName, cb)
    };

    // The wildcard here is for cases when the (network) client doesn't invoke
    // the server-name (SNI) extension. In such cases, we arrange to present our
    // configured wildcard (hostname `*`) certificate, if there is one
    // configured.
    const wildcardItem = this.#findItem('*', true);

    if (wildcardItem) {
      const { certificate, privateKey } = await wildcardItem.getParameters();
      result.cert = certificate;
      result.key  = privateKey;
    }

    return result;
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
   * @param {string} serverName Name of the host to find, or `*` to
   *   explicitly request the wildcard / fallback context.
   * @param {function(?object, ?SecureContext)} callback Callback to present
   *   with the results.
   */
  async sniCallback(serverName, callback) {
    const found    = this.#findItem(serverName, false);
    let   foundCtx = null;

    if (found) {
      this.#logger.foundMatchFor(serverName, found.config.hostnames);
      foundCtx = await found.getSecureContext();
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
   * Finds the most-specific {@link HostItem} for a given hostname. In case of
   * an invalid hostname, this logs the problem but does not throw an error.
   *
   * @param {string} name Hostname to look for.
   * @param {boolean} allowWildcard Is `name` allowed to be a wildcard (partial
   *   or full)?
   * @returns {?HostItem} The associated item, or `null` if nothing suitable is
   *   found.
   */
  #findItem(name, allowWildcard) {
    const key = Uris.parseHostnameOrNull(name, allowWildcard);

    if (key === null) {
      this.#logger.invalidHostname(name);
      return null;
    }

    const found = this.#items.find(key);
    return found ? found.value : null;
  }
}
