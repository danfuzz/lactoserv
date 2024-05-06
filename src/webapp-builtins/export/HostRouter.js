// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreeMap } from '@this/collections';
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
   * @type {?TreeMap<IntfRequestHandler>}
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
  async _impl_init() {
    const routes = {};
    for (const [host, name] of this.config.hosts) {
      routes[HostUtil.hostnameStringFrom(host)] = name;
    }

    this.logger?.routes(routes);

    await super._impl_init();
  }

  /** @override */
  async _impl_start() {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const appManager = this.root.applicationManager;
    const routeTree  = new TreeMap();

    for (const [host, name] of this.config.hosts) {
      const app = appManager.get(name);
      routeTree.add(host, app);
    }

    this.#routeTree = routeTree;

    await super._impl_start();
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
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
      /**
       * Map which goes from a host prefix to the name of an application which
       * should handle that prefix. Each host must be a valid
       * possibly-wildcarded host name, per {@link HostUtil#parseHostname}. Each
       * name must be a valid component name, per {@link Names#checkName}. On
       * input, the value must be a plain object.
       *
       * @param {object} value Proposed configuration value.
       * @returns {TreeMap<string>} Accepted configuration value.
       */
      _config_hosts(value) {
        MustBe.plainObject(value);

        const result = new TreeMap();

        for (const [host, name] of Object.entries(value)) {
          Names.checkName(name);
          const key = HostUtil.parseHostname(host, true);
          result.add(key, name);
        }

        return Object.freeze(result);
      }
    };
  }
}
