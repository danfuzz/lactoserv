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
import { EndpointManager } from '#x/EndpointManager';
import { HostManager } from '#x/HostManager';
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
  /** @type {ComponentManager} Application manager. */
  #applicationManager;

  /** @type {?HostManager} Host manager, if configured. */
  #hostManager;

  /** @type {EndpointManager} Endpoint manager, for all endpoint bindings. */
  #endpointManager;

  /** @type {ComponentManager} Service manager. */
  #serviceManager;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    MustBe.plainObject(config);

    super(ThisModule.subsystemLogger('warehouse'));

    const parsed = new WarehouseConfig(config);

    this.#applicationManager = new ComponentManager(parsed.applications, {
      baseClass:     BaseApplication,
      baseSublogger: ThisModule.cohortLogger('app'),
      logger:        ThisModule.subsystemLogger('apps')
    });

    this.#serviceManager = new ComponentManager(parsed.services, {
      baseClass:     BaseService,
      baseSublogger: ThisModule.cohortLogger('service'),
      logger:        ThisModule.subsystemLogger('services')
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
   * @type {number} Grace period after asking all applications to stop before
   * asking services to shut down. (If the applications stop more promptly, then
   * the system will immediately move on.)
   */
  static #APPLICATION_STOP_GRACE_PERIOD_MSEC = 250;

  /**
   * @type {number} Grace period after asking all endpoints to stop before
   * asking applications and services to shut down. (If the endpoints stop more
   * promptly, then the system will immediately move on.)
   */
  static #ENDPOINT_STOP_GRACE_PERIOD_MSEC = 250;
}
