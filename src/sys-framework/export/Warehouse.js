// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PromiseUtil } from '@this/async';
import { WallClock } from '@this/clocks';
import { WarehouseConfig } from '@this/sys-config';
import { MustBe } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { BaseControllable } from '#x/BaseControllable';
import { BaseService } from '#x/BaseService';
import { ComponentManager } from '#x/ComponentManager';
import { ControlContext } from '#x/ControlContext';
import { EndpointManager } from '#x/EndpointManager';
import { HostManager } from '#x/HostManager';
import { RootControlContext } from '#x/RootControlContext';
import { ThisModule } from '#p/ThisModule';


/**
 * "Warehouse" of bits and pieces created from a top-level configuration.
 *
 * **Note:** When `start()`ing, this operates in the order services then
 * applications then endpoints, so as to start dependencies before dependants.
 * Similarly, when `stop()`ping, the order is reversed, though the system will
 * press on with the `stop()` actions if an earlier layer is taking too long.
 */
export class Warehouse extends BaseControllable {
  /**
   * Application manager.
   *
   * @type {ComponentManager}
   */
  #applicationManager;

  /**
   * Host manager, if configured.
   *
   * @type {?HostManager}
   */
  #hostManager;

  /**
   * Endpoint manager, for all endpoint bindings.
   *
   * @type {EndpointManager}
   */
  #endpointManager;

  /**
   * Service manager.
   *
   * @type {ComponentManager}
   */
  #serviceManager;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    MustBe.plainObject(config);

    // Note: `super()` is called with an argument exactly because this instance
    // is the root of its hierarchy.
    super(new RootControlContext(ThisModule.subsystemLogger('warehouse')));

    const parsed = new WarehouseConfig(config);

    this.#applicationManager = new ComponentManager(parsed.applications, {
      baseClass:     BaseApplication,
      baseSublogger: ThisModule.cohortLogger('app')
    });

    this.#serviceManager = new ComponentManager(parsed.services, {
      baseClass:     BaseService,
      baseSublogger: ThisModule.cohortLogger('service')
    });

    this.#hostManager     = new HostManager(parsed.hosts);
    this.#endpointManager = new EndpointManager(parsed.endpoints, this);
  }

  /** @returns {ComponentManager} Application manager. */
  get applicationManager() {
    return this.#applicationManager;
  }

  /**
   * @returns {?HostManager} Host manager secure contexts, if needed. Can be
   * `null` if all endpoints are insecure.
   */
  get hostManager() {
    return this.#hostManager;
  }

  /** @returns {EndpointManager} Server manager. */
  get endpointManager() {
    return this.#endpointManager;
  }

  /** @returns {ComponentManager} Service manager. */
  get serviceManager() {
    return this.#serviceManager;
  }

  /** @override */
  async _impl_init(isReload) {
    const callInit = (name, obj) => {
      const context = new ControlContext(obj, this, ThisModule.subsystemLogger(name));
      return obj.init(context, isReload);
    };

    const results = [
      callInit('services',  this.#serviceManager),
      callInit('apps',      this.#applicationManager),
      callInit('endpoints', this.#endpointManager)
    ];

    await Promise.all(results);
  }

  /** @override */
  async _impl_start(isReload = false) {
    await this.#serviceManager.start(isReload);
    await this.#applicationManager.start(isReload);
    await this.#endpointManager.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload = false) {
    const endpointsStopped = this.#endpointManager.stop(willReload);

    await PromiseUtil.race([
      endpointsStopped,
      WallClock.waitForMsec(Warehouse.#ENDPOINT_STOP_GRACE_PERIOD_MSEC)
    ]);

    const applicationsStopped = this.#applicationManager.stop(willReload);
    await PromiseUtil.race([
      applicationsStopped,
      WallClock.waitForMsec(Warehouse.#APPLICATION_STOP_GRACE_PERIOD_MSEC)
    ]);

    await Promise.all([
      endpointsStopped,
      applicationsStopped,
      this.#serviceManager.stop(willReload)
    ]);
  }


  //
  // Static members
  //

  /**
   * Grace period after asking all applications to stop before
   * asking services to shut down. (If the applications stop more promptly, then
   * the system will immediately move on.)
   *
   * @type {number}
   */
  static #APPLICATION_STOP_GRACE_PERIOD_MSEC = 250;

  /**
   * Grace period after asking all endpoints to stop before
   * asking applications and services to shut down. (If the endpoints stop more
   * promptly, then the system will immediately move on.)
   *
   * @type {number}
   */
  static #ENDPOINT_STOP_GRACE_PERIOD_MSEC = 250;
}
