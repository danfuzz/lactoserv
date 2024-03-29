// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfRequestHandler } from '@this/net-util';
import { Names } from '@this/sys-compote';
import { BaseApplication } from '@this/sys-framework';
import { MustBe } from '@this/typey';


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

  // Note: The default constructor is fine for this class.

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
  async _impl_init(isReload_unused) {
    this.logger?.routes(this.config.routes);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.


    const context   = this.context;
    const routeList = [];

    for (const name of this.config.routeList) {
      const app = context.getComponent(name, BaseApplication);
      routeList.push(app);
    }

    this.#routeList = routeList;
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
     * Like the outer `routeList` except with names instead of application
     * instances.
     *
     * @type {Array<string>}
     */
    #routeList;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { applications } = rawConfig;

      MustBe.arrayOfString(applications);

      for (const name of applications) {
        Names.checkName(name);
      }

      // `[...]` to copy the list in order to avoid outside interference.
      this.#routeList = [...applications];
    }

    /**
     * @returns {Array<string>} Like the outer `routeList` except with names
     * instead of application instances.
     */
    get routeList() {
      return this.#routeList;
    }
  };
}
