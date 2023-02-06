// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers/promises';

import { ApplicationConfig, ServiceConfig, WarehouseConfig } from '@this/app-config';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { ApplicationManager } from '#x/ApplicationManager';
import { BaseControllable } from '#x/BaseControllable';
import { HostManager } from '#x/HostManager';
import { ServerManager } from '#x/ServerManager';
import { ServiceFactory } from '#x/ServiceFactory';
import { ServiceManager } from '#x/ServiceManager';
import { ThisModule } from '#p/ThisModule';


/**
 * "Warehouse" of bits and pieces created from a top-level configuration.
 *
 * Configuration object details:
 *
 * * `{object|object[]} hostnames` -- Host / certificate configuration.
 *   Required if a server is configured to listen for secure connections.
 * * `{object|object[]} servers` -- Server configuration.
 * * `{object|object[]} services` -- System service configuration.
 * * `{object|object[]} applications` -- Application configuration.
 *
 * **Note:** When `start()`ing, this operates in the order services then
 * applications then servers, so as to start dependencies before dependants.
 * Similarly, when `stop()`ping, the order is reversed, though the system will
 * press on with the `stop()` actions if an earlier layer is taking too long.
 */
export class Warehouse extends BaseControllable {
  /** @type {ApplicationManager} Application manager. */
  #applicationManager;

  /** @type {?HostManager} Host manager, if configured. */
  #hostManager;

  /** @type {ServerManager} Server manager, for all server bindings. */
  #serverManager;

  /** @type {ServiceManager} Service manager. */
  #serviceManager;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    super(ThisModule.logger.warehouse);

    const mapper = (conf, baseClass) => {
      switch (baseClass) {
        case ApplicationConfig: return ApplicationFactory.configClassFromType(conf.type);
        case ServiceConfig:     return ServiceFactory.configClassFromType(conf.type);
      }
      return baseClass;
    };

    const parsed = new WarehouseConfig(config, mapper);

    this.#hostManager        = new HostManager(parsed.hosts);
    this.#serviceManager     = new ServiceManager(parsed.services);
    this.#applicationManager = new ApplicationManager(parsed.applications);
    this.#serverManager      = new ServerManager(parsed.servers, this);
  }

  /** @returns {ApplicationManager} Application manager. */
  get applicationManager() {
    return this.#applicationManager;
  }

  /**
   * @returns {?HostManager} Host manager secure contexts, if needed. Can be
   * `null` if all servers are insecure.
   */
  get hostManager() {
    return this.#hostManager;
  }

  /** @returns {ServerManager} Server manager. */
  get serverManager() {
    return this.#serverManager;
  }

  /** @returns {ServiceManager} Service manager. */
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
    const serversStopped = this.#serverManager.stop(willReload);

    await Promise.race([
      serversStopped,
      timers.setTimeout(Warehouse.#SERVER_STOP_GRACE_PERIOD_MSEC)
    ]);

    const applicationsStopped = this.#applicationManager.stop(willReload);
    await Promise.race([
      applicationsStopped,
      timers.setTimeout(Warehouse.#APPLICATION_STOP_GRACE_PERIOD_MSEC)
    ]);

    await Promise.all([
      serversStopped,
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
   * @type {number} Grace period after asking all servers to stop before asking
   * applications and services to shut down. (If the servers stop more promptly,
   * then the system will immediately move on.)
   */
  static #SERVER_STOP_GRACE_PERIOD_MSEC = 250;
}
