// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SecureContext } from 'node:tls';

import { TreeMap } from '@this/collections';
import { BaseComponent, TemplAggregateComponent } from '@this/compy';
import { IntfLogger } from '@this/loggy-intf';
import { IntfHostManager } from '@this/net-protocol';
import { HostUtil } from '@this/net-util';
import { MustBe } from '@this/typey';

import { NetworkHost } from '#x/NetworkHost';


/**
 * Manager for dealing with all the hostname bindings. "Hosts" in this sense are
 * network-available endpoints associated with particular names, certificates,
 * and private keys. The main thing offered by this class is the association
 * between hostnames and TLS contexts.
 *
 * @implements {IntfHostManager}
 */
export class HostManager extends TemplAggregateComponent('HostAggregate', BaseComponent) {
  /**
   * Main implementation.
   *
   * @type {HostManager.HostMap}
   */
  #hostMap = null;

  // @defaultConstructor

  /** @override */
  findContext(name) {
    return this.#hostMap.findContext(name);
  }

  /** @override */
  getSecureServerOptions() {
    return this.#hostMap.getSecureServerOptions();
  }

  /**
   * Makes an instance with the given subset of bindings. Wildcard hostnames in
   * `names` are matched as wildcards with the existing bindings, so, for
   * example, passing a complete wildcard hostname will produce a clone of this
   * instance.
   *
   * @param {Array<string>} names Hostnames (including wildcards) which are to
   *   be included in the subset.
   * @returns {IntfHostManager} Subsetted instance.
   * @throws {Error} Thrown if any of the `names` is found not to match any
   *   bindings in this instance.
   */
  makeSubset(names) {
    return this.#hostMap.makeSubset(names);
  }

  /** @override */
  async _impl_init() {
    this.#hostMap = new HostManager.HostMap(this.logger);
    await super._impl_init();
  }

  /** @override */
  async _impl_start() {
    this.#hostMap.logHostMap();

    const hosts   = [...this.children()];
    const results = hosts.map((h) => h.start());

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const hosts   = [...this.children()];
    const results = hosts.map((h) => h.stop(willReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_addChild(host) {
    this.#hostMap.addHost(host);
  }

  /** @override */
  _impl_isChildAllowed(host) {
    MustBe.instanceOf(host, NetworkHost);
    this.#hostMap.checkHost(host);

    return true;
  }


  //
  // Static members
  //

  /**
   * The main implementation of this (outer) class. This exists as a separate
   * inner class so that we can make host manager subsets that aren't also
   * components (as in, the sort of thing managed by the `compy` module).
   *
   * @implements {IntfHostManager}
   */
  static HostMap = class HostMap {
    /**
     * Logger to use, if any.
     *
     * @type {?IntfLogger}
     */
    #logger;

    /**
     * Map from each componentized hostname to the {@link NetworkHost} that
     * should be used for it.
     *
     * @type {TreeMap<NetworkHost>}
     */
    #items = new TreeMap(HostUtil.hostnameStringFrom);

    /**
     * Constructs an instance.
     *
     * @param {?IntfLogger} logger Logger to use, if any.
     */
    constructor(logger) {
      this.#logger = logger;
    }

    /**
     * Adds a host.
     *
     * @param {NetworkHost} host Host to add.
     */
    addHost(host) {
      for (const name of host.config.hostnames) {
        const key = HostUtil.parseHostname(name, true);
        this.#items.add(key, host);
      }
    }

    /**
     * Can a host be added?
     *
     * @param {NetworkHost} host Host to add.
     * @throws {Error} Thrown if there would be a problem adding it.
     */
    checkHost(host) {
      for (const name of host.config.hostnames) {
        const key = HostUtil.parseHostname(name, true);

        if (this.#items.has(key)) {
          throw new Error(`Duplicate hostname: ${name}`);
        }
      }
    }

    /** @override */
    findContext(name) {
      const item = this.#findItem(name, true);
      return item ? item.getSecureContext() : null;
    }

    /** @override */
    getSecureServerOptions() {
      const result = {
        SNICallback: (serverName, cb) => this.#sniCallback(serverName, cb)
      };

      // The wildcard here is for cases when the (network) client doesn't invoke
      // the server-name (SNI) extension. In such cases, we arrange to present
      // our configured wildcard (hostname `*`) certificate, if there is one
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
     * Logs the current contents of the host map.
     */
    logHostMap() {
      const result = {};

      for (const [key, host] of this.#items) {
        result[HostUtil.hostnameStringFrom(key)] = host.config.hostnames;
      }

      this.#logger?.knownHosts(result);
    }

    /**
     * Core implementation of the outer class method of the same name.
     *
     * @param {Array<string>} names Hostnames to include.
     * @returns {HostManager.HostMap} Subsetted instance.
     */
    makeSubset(names) {
      const result = new HostMap(this.#logger);
      const items  = result.#items;

      for (const name of names) {
        const key   = HostUtil.parseHostname(name, true);
        const found = this.#items.findSubtree(key);
        if (found.size === 0) {
          throw new Error(`No bindings found for hostname: ${name}`);
        }
        for (const [k, v] of found) {
          // Don't even try to add elements we've already added (which would
          // fail).
          if (!items.has(k)) {
            items.add(k, v);
          }
        }
      }

      return result;
    }

    /**
     * Finds the most-specific {@link NetworkHost} for a given hostname. In case
     * of an invalid hostname, this logs the problem but does not throw an
     * error.
     *
     * @param {string} name Hostname to look for.
     * @param {boolean} allowWildcard Is `name` allowed to be a wildcard
     *   (partial or full)?
     * @returns {?NetworkHost} The associated item, or `null` if nothing
     *   suitable is found.
     */
    #findItem(name, allowWildcard) {
      const key = HostUtil.parseHostnameOrNull(name, allowWildcard);

      if (key === null) {
        this.#logger?.invalidHostname(name);
        return null;
      }

      const found = this.#items.find(key);

      return found ? found.value : null;
    }

    /**
     * Like {@link #findContext}, except in the exact form that is expected as
     * an `SNICallback` configured in the options of a call to (something like)
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
        this.#logger?.found(serverName, found.config.hostnames);
        foundCtx = found.getSecureContext();
      } else {
        this.#logger?.notFound(serverName);
      }

      try {
        callback(null, foundCtx);
      } catch (e) {
        this.#logger?.errorDuringCallback(e);
        callback(e, null);
      }
    }
  };
}
