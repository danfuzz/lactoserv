// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SecureContext } from 'node:tls';

import { TreePathMap } from '@this/collections';
import { BaseComponent, BaseConfig } from '@this/compy';
import { IntfHostManager } from '@this/net-protocol';
import { HostUtil } from '@this/net-util';

import { NetworkHost } from '#x/NetworkHost';


/**
 * Manager for dealing with all the hostname bindings. "Hosts" in this sense are
 * network-available endpoints associated with particular names, certificates,
 * and private keys. The main thing offered by this class is the association
 * between hostnames and TLS contexts.
 *
 * @implements {IntfHostManager}
 */
export class HostManager extends BaseComponent {
  /**
   * List of all host objects.
   *
   * @type {Array<NetworkHost>}
   */
  #allHosts;

  /**
   * Map from each componentized hostname to the {@link NetworkHost} that should
   * be used for it.
   *
   * @type {TreePathMap<NetworkHost>}
   */
  #items = new TreePathMap(HostUtil.hostnameStringFrom);

  /**
   * Constructs an instance.
   *
   * @param {Array<NetworkHost>} [hosts] Host handler objects.
   */
  constructor(hosts = []) {
    super({ name: 'host' });

    this.#allHosts = hosts;

    for (const host of hosts) {
      this.#addInstance(host);
    }
  }

  /** @override */
  findContext(name) {
    const item = this.#findItem(name, true);
    return item ? item.getSecureContext() : null;
  }

  /**
   * Gets a list of all host instances managed by this instance.
   *
   * @returns {Array<NetworkHost>} All the host instances.
   */
  getAll() {
    // Make a copy so as not to expose our innards.
    return [...this.#allHosts];
  }

  /** @override */
  getSecureServerOptions() {
    const result = {
      SNICallback: (serverName, cb) => this.#sniCallback(serverName, cb)
    };

    // The wildcard here is for cases when the (network) client doesn't invoke
    // the server-name (SNI) extension. In such cases, we arrange to present our
    // configured wildcard (hostname `*`) certificate, if there is one
    // configured.
    const wildcardItem = this.#findItem('*', true);

    if (wildcardItem) {
      const { certificate, privateKey } = wildcardItem.getParameters();
      result.cert = certificate;
      result.key  = privateKey;
    }

    return result;
  }

  /**
   * Makes an instance with the given subset of bindings. Wildcard hostnames in
   * `names` are matched as wildcards with the existing bindings, so, for
   * example, passing a complete wildcard hostname will produce a clone of this
   * instance.
   *
   * @param {Array<string>} names Hostnames (including wildcards) which are to
   *   be included in the subset.
   * @returns {HostManager} Subsetted instance.
   * @throws {Error} Thrown if any of the `names` is found not to match any
   *   bindings in this instance.
   */
  makeSubset(names) {
    const result = new HostManager();

    for (const name of names) {
      const key   = HostUtil.parseHostname(name, true);
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

  /** @override */
  async _impl_init(isReload) {
    const hosts = this.getAll();

    const results = hosts.map((h) => {
      return this._prot_addChild(h, isReload);
    });

    await Promise.all(results);
  }

  /** @override */
  async _impl_start(isReload) {
    const hosts   = this.getAll();
    const results = hosts.map((h) => h.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const hosts   = this.getAll();
    const results = hosts.map((h) => h.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Validates the given instance, and adds it to {@link #items}.
   *
   * @param {NetworkHost} host Host instance.
   */
  #addInstance(host) {
    for (const name of host.config.hostnames) {
      const key = HostUtil.parseHostname(name, true);

      if (this.#items.has(key)) {
        throw new Error(`Duplicate hostname: ${name}`);
      }

      this.#items.add(key, host);
      this.logger?.bound(name);
    }
  }

  /**
   * Finds the most-specific {@link NetworkHost} for a given hostname. In case
   * of an invalid hostname, this logs the problem but does not throw an error.
   *
   * @param {string} name Hostname to look for.
   * @param {boolean} allowWildcard Is `name` allowed to be a wildcard (partial
   *   or full)?
   * @returns {?NetworkHost} The associated item, or `null` if nothing suitable
   *   is found.
   */
  #findItem(name, allowWildcard) {
    const key = HostUtil.parseHostnameOrNull(name, allowWildcard);

    if (key === null) {
      this.logger?.invalidHostname(name);
      return null;
    }

    const found = this.#items.find(key);
    return found ? found.value : null;
  }

  /**
   * Like {@link #findContext}, except in the exact form that is expected as an
   * `SNICallback` configured in the options of a call to (something like)
   * `http2.createSecureServer()`.
   *
   * See
   * <https://nodejs.org/dist/latest-v18.x/docs/api/tls.html#tlscreateserveroptions-secureconnectionlistener>
   * for details.
   *
   * @param {string} serverName Name of the host to find, or `*` to explicitly
   *   request the wildcard / fallback context.
   * @param {function(?object, ?SecureContext)} callback Callback to present
   *   with the results.
   */
  #sniCallback(serverName, callback) {
    const found    = this.#findItem(serverName, false);
    let   foundCtx = null;

    if (found) {
      this.logger?.found(serverName, found.config.hostnames);
      foundCtx = found.getSecureContext();
    } else {
      this.logger?.notFound(serverName);
    }

    try {
      callback(null, foundCtx);
    } catch (e) {
      this.logger?.errorDuringCallback(e);
      callback(e, null);
    }
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return BaseConfig;
  }
}
