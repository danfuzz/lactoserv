// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathMap } from '@this/collections';
import { Names } from '@this/compy';
import { HostUtil, IntfRequestHandler } from '@this/net-util';
import { MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that routes requests based on the requests' `host` headers (or
 * equivalent). See docs for configuration object details.
 */
export class HostRouter extends BaseApplication {
  /**
   * Map which goes from a host prefix to a handler (typically a {@link
   * BaseApplication}) which should handle that prefix. Gets set in {@link
   * #_impl_start}.
   *
   * @type {?TreePathMap<IntfRequestHandler>}
   */
  #routeTree = null;

  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const host  = request.host;
    const found = this.#routeTree.find(host.nameKey);

    if (!found) {
      return null;
    }

    const application = found.value;

    request.logger?.dispatchingHost({
      application: application.name,
      host:        host.namePortString
    });

    return application.handleRequest(request, dispatch);
  }

  /** @override */
  async _impl_init(isReload_unused) {
    const routes = {};
    for (const [host, name] of this.config.routeTree) {
      routes[HostUtil.hostnameStringFrom(host)] = name;
    }

    this.logger?.routes(routes);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const appManager = this.root.applicationManager;
    const routeTree  = new TreePathMap();

    for (const [host, name] of this.config.routeTree) {
      const app = appManager.get(name);
      routeTree.add(host, app);
    }

    this.#routeTree = routeTree;
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseApplication.Config {
    /**
     * Like the outer `routeTree` except with names instead of handler
     * instances.
     *
     * @type {TreePathMap<string>}
     */
    #routeTree;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { hosts } = rawConfig;

      MustBe.plainObject(hosts);

      const routeTree = new TreePathMap();

      for (const [host, name] of Object.entries(hosts)) {
        Names.checkName(name);
        const key = HostUtil.parseHostname(host, true);
        routeTree.add(key, name);
      }

      this.#routeTree = routeTree;
    }

    /**
     * @returns {TreePathMap<string>} Like the outer `routeTree` except with
     * names instead of handler instances.
     */
    get routeTree() {
      return this.#routeTree;
    }
  };
}
