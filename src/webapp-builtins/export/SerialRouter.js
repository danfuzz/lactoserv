// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Names } from '@this/compy';
import { IntfRequestHandler } from '@this/net-util';
import { StringUtil } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that routes requests to a list of applications in order, until
 * one handles (or tries to handle) the request. See docs for configuration
 * object details.
 */
export class SerialRouter extends BaseApplication {
  /**
   * List of handlers (typically instances of {@link BaseApplication}) to route
   * to. Gets set in {@link #_impl_start}.
   *
   * @type {Array<IntfRequestHandler>}
   */
  #routeList = null;

  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    for (const app of this.#routeList) {
      request.logger?.dispatching(request.id, { application: app.name });

      const result = await app.handleRequest(request, dispatch);
      if (result !== null) {
        return result;
      }
      // `result === null`, so we iterate to try the next handler (if any).
    }

    return null;
  }

  /** @override */
  async _impl_init() {
    this.logger?.routes(this.config.applications);
    await super._impl_init();
  }

  /** @override */
  async _impl_start() {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const appManager = this.root.applicationManager;
    const routeList  = [];

    for (const name of this.config.applications) {
      const app = appManager.get(name);
      routeList.push(app);
    }

    this.#routeList = routeList;
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
      // @defaultConstructor

      /**
       * List of the names of all the applications to route to, in order. Each
       * name must be a valid component name, per {@link Names#checkName}.
       *
       * @param {Array<string>} value Proposed configuration value.
       * @returns {Array<string>} Accepted configuration value.
       */
      _config_applications(value) {
        return StringUtil.checkAndFreezeStrings(
          value,
          (item) => Names.checkName(item));
      }
    };
  }
}
