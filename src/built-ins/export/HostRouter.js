// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathMap } from '@this/collections';
import { IntfRequestHandler, Uris } from '@this/net-util';
import { Names } from '@this/sys-config';
import { BaseApplication } from '@this/sys-framework';
import { MustBe } from '@this/typey';


/**
 * Application that routes requests based on the requests' `host` headers (or
 * equivalent). See docs for configuration object details.
 */
export class HostRouter extends BaseApplication {
  /**
   * @type {?TreePathMap<IntfRequestHandler>} Map which goes from a host prefix
   * to a handler (typically a {@link BaseApplication}) which should handle that
   * prefix. Gets set in {@link #_impl_start}.
   */
  #routeTree = null;

  // Note: The default constructor is fine for this class.

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
      routes[host.toHostnameString()] = name;
    }

    this.logger?.routes(routes);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const context   = this.context;
    const routeTree = new TreePathMap();

    for (const [host, name] of this.config.routeTree) {
      const app = context.getComponent(name, BaseApplication);
      routeTree.add(host, app);
    }

    this.#routeTree = routeTree;
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseApplication.FilterConfig {
    /**
     * @type {TreePathMap<string>} Like the outer `routeTree` except with names
     * instead of handler instances.
     */
    #routeTree;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const { hosts } = config;

      MustBe.plainObject(hosts);

      const routeTree = new TreePathMap();

      for (const [host, name] of Object.entries(hosts)) {
        Names.checkName(name);
        const key = Uris.parseHostname(host, true);
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
