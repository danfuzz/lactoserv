// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Names } from '@this/compy';
import { StringUtil } from '@this/typey';
import { BaseService } from '@this/webapp-core';


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
  async _impl_init() {
    this.logger?.targets(this.config.services);
  }

  /** @override */
  async _impl_start() {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced services have already been added when
    // that runs.

    const serviceManager = this.root.serviceManager;
    const services       = [];

    for (const name of this.config.services) {
      const service = serviceManager.get(name);
      services.push(service);
    }

    this.#services = services;
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
       * Names of services to fan out to. Each name must be a valid component
       * name, per {@link Names#checkName}.
       *
       * @param {string|Array<string>} value Proposed configuration value.
       * @returns {Array<string>} Accepted configuration value.
       */
      _config_services(value) {
        return StringUtil.checkAndFreezeStrings(
          value,
          (item) => Names.checkName(item));
      }
    };
  }
}
