// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { WarehouseConfig } from '@this/app-config';
import { MustBe } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { BaseControllable } from '#x/BaseControllable';
import { BaseService } from '#x/BaseService';
import { ComponentManager } from '#x/ComponentManager';
import { ComponentRegistry } from '#x/ComponentRegistry';
import { HostManager } from '#x/HostManager';
import { EndpointManager } from '#x/EndpointManager';
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
  #serverManager;

  /** @type {ComponentManager} Service manager. */
  #serviceManager;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   * @param {ComponentRegistry} registry Registry of component classes.
   */
  constructor(config, registry) {
    MustBe.plainObject(config);
    MustBe.instanceOf(registry, ComponentRegistry);

    super(ThisModule.logger.warehouse);

    const parsed = new WarehouseConfig(config, registry.configClassMapper);

    this.#applicationManager = new ComponentManager(parsed.applications, {
      baseClass:     BaseApplication,
      baseSublogger: ThisModule.logger.app,
      logger:        ThisModule.logger.apps,
      registry
    });

    this.#serviceManager = new ComponentManager(parsed.services, {
      baseClass:     BaseService,
      baseSublogger: ThisModule.logger.service,
      logger:        ThisModule.logger.services,
      registry
    });

    this.#hostManager   = new HostManager(parsed.hosts);
    this.#serverManager = new EndpointManager(parsed.endpoints, this);
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
  get serverManager() {
    return this.#serverManager;
  }

  /** @returns {ComponentManager} Service manager. */
  get serviceManager() {
    return this.#serviceManager;
  }

  /** @override */
  async _impl_start(isReload = false) {
    await this.#serviceManager.start(isReload);
    await this.#applicationManager.start(isReload);
    await this.#serverManager.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload = false) {
    const endpointsStopped = this.#serverManager.stop(willReload);

    await Promise.race([
      endpointsStopped,
      timers.setTimeout(Warehouse.#ENDPOINT_STOP_GRACE_PERIOD_MSEC)
    ]);

    const applicationsStopped = this.#applicationManager.stop(willReload);
    await Promise.race([
      applicationsStopped,
      timers.setTimeout(Warehouse.#APPLICATION_STOP_GRACE_PERIOD_MSEC)
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
