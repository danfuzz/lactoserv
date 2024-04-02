// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Names } from '@this/compote';
import { BaseService } from '@this/sys-framework';
import { MustBe } from '@this/typey';


/**
 * Service which fans out all events in parallel to a set of other services. It
 * implements no call (non-event) handlers. Instances will claim to implement
 * any interface claimed by any of the set it fans out to.
 *
 * See `doc/configuration` for configuration object details.
 */
export class EventFan extends BaseService {
  /**
   * List of services to fan out to.
   *
   * @type {Array<BaseService>}
   */
  #services = null;

  // @defaultConstructor

  /** @override */
  async _impl_handleEvent(payload) {
    const promises = [];

    for (const service of this.#services) {
      promises.push(service.handleEvent(payload));
    }

    const results = await Promise.allSettled(promises);
    const errors  = [];
    let   handled = false;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        handled ||= result.value;
      } else {
        errors.push(result.reason);
      }
    }

    if (errors.length === 0) {
      return handled;
    } else {
      throw new AggregateError(errors);
    }
  }

  /** @override */
  _impl_implementedInterfaces() {
    const ifaces = new Set();

    for (const service of this.#services) {
      for (const iface of service.implementedInterfaces) {
        ifaces.add(iface);
      }
    }

    return [...ifaces];
  }

  /** @override */
  async _impl_init(isReload_unused) {
    this.logger?.targets(this.config.services);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced services have already been added when
    // that runs.

    const context  = this.context;
    const services = [];

    for (const name of this.config.routeList) {
      const service = context.getComponent(name, BaseService);
      services.push(service);
    }

    this.#services = services;
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // No need to do anything.
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
  static #Config = class Config extends BaseService.Config {
    /**
     * Like the outer `services` except with names instead of service instances.
     *
     * @type {Array<string>}
     */
    #services;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { services } = rawConfig;

      MustBe.arrayOfString(services);

      for (const name of services) {
        Names.checkName(name);
      }

      // `[...]` to copy the list in order to avoid outside interference.
      this.#services = [...services];
    }

    /**
     * @returns {Array<string>} Like the outer `services` except with names
     * instead of service instances.
     */
    get services() {
      return this.#services;
    }
  };
}
