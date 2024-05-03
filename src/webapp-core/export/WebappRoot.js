// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PromiseUtil } from '@this/async';
import { WallClock } from '@this/clocky';
import { BaseComponent, RootControlContext }
  from '@this/compy';

import { BaseApplication } from '#x/BaseApplication';
import { BaseService } from '#x/BaseService';
import { ComponentManager } from '#x/ComponentManager';
import { HostManager } from '#x/HostManager';
import { NetworkEndpoint } from '#x/NetworkEndpoint';
import { NetworkHost } from '#x/NetworkHost';
import { ThisModule } from '#p/ThisModule';


/**
 * Root component which contains all the subcomponents required to operate a
 * specific webapp. Instances of this class can reasonably be called "webapps"
 * per se.
 *
 * **Note:** When `start()`ing, this operates in the order hosts then services
 * then applications then endpoints, so as to start dependencies before
 * dependants. Similarly, when `stop()`ping, the order is reversed, though the
 * system will press on with the `stop()` actions if an earlier layer is taking
 * too long.
 */
export class WebappRoot extends BaseComponent {
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
   * @type {ComponentManager}
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
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    // Note: `super()` is called with a second argument exactly because this
    // instance is the root of its hierarchy.
    super(
      {
        ...rawConfig,
        name: 'root'
      },
      new RootControlContext(ThisModule.logger));

    this.#applicationManager = new ComponentManager({
      baseClass: BaseApplication,
      name:      'application'
    });

    this.#serviceManager = new ComponentManager({
      baseClass: BaseService,
      name:      'service'
    });

    this.#endpointManager = new ComponentManager({
      baseClass: NetworkEndpoint,
      name:      'endpoint'
    });

    this.#hostManager = new HostManager({ name: 'host' });
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

  /** @returns {ComponentManager} Endpoint manager. */
  get endpointManager() {
    return this.#endpointManager;
  }

  /** @returns {ComponentManager} Service manager. */
  get serviceManager() {
    return this.#serviceManager;
  }

  /** @override */
  async _impl_init() {
    const results = [
      this._prot_addChild(this.#serviceManager),
      this._prot_addChild(this.#applicationManager),
      this._prot_addChild(this.#hostManager),
      this._prot_addChild(this.#endpointManager)
    ];

    await Promise.all(results);

    const { applications, hosts, endpoints, services } = this.config;

    await this.#applicationManager.addChildren(applications);
    await this.#hostManager.addChildren(hosts);
    await this.#endpointManager.addChildren(endpoints);
    await this.#serviceManager.addChildren(services);
  }

  /** @override */
  async _impl_start() {
    await this.#hostManager.start();
    await this.#serviceManager.start();
    await this.#applicationManager.start();
    await this.#endpointManager.start();
  }

  /** @override */
  async _impl_stop(willReload) {
    const endpointsStopped = this.#endpointManager.stop(willReload);

    await PromiseUtil.race([
      endpointsStopped,
      WallClock.waitForMsec(WebappRoot.#ENDPOINT_STOP_GRACE_PERIOD_MSEC)
    ]);

    const applicationsStopped = this.#applicationManager.stop(willReload);
    await PromiseUtil.race([
      applicationsStopped,
      WallClock.waitForMsec(WebappRoot.#APPLICATION_STOP_GRACE_PERIOD_MSEC)
    ]);

    await Promise.all([
      endpointsStopped,
      applicationsStopped,
      this.#serviceManager.stop(willReload),
      this.#hostManager.stop(willReload)
    ]);
  }


  //
  // Static members
  //

  /**
   * Grace period after asking all applications to stop before asking services
   * to shut down. (If the applications stop more promptly, then the system will
   * immediately move on.)
   *
   * @type {number}
   */
  static #APPLICATION_STOP_GRACE_PERIOD_MSEC = 250;

  /**
   * Grace period after asking all endpoints to stop before asking applications
   * and services to shut down. (If the endpoints stop more promptly, then the
   * system will immediately move on.)
   *
   * @type {number}
   */
  static #ENDPOINT_STOP_GRACE_PERIOD_MSEC = 250;

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseComponent.Config {
    // @defaultConstructor

    /**
     * Application instances, or `null` to have no configured applications
     * (which would be unusual). On input, this is expected to be an object
     * suitable as an argument to {@link BaseComponent#evalArray} (see which).
     *
     * @param {?object|Array<BaseApplication|BaseApplication.Config>} [value]
     *   Proposed configuration value. Default `null`.
     * @returns {Array<BaseApplication>} Accepted configuration value.
     */
    _config_applications(value = null) {
      return BaseApplication.evalArray(value ?? []);
    }

    /**
     * Endpoint instances, or `null` to have no configured endpoints (which
     * would be unusual). On input, this is expected to be an object suitable as
     * an argument to {@link BaseComponent#evalArray} (see which).
     *
     * @param {?object|Array<NetworkEndpoint|NetworkEndpoint.Config>} [value]
     *   Proposed configuration value. Default `null`.
     * @returns {Array<NetworkEndpoint>} Accepted configuration value.
     */
    _config_endpoints(value = null) {
      return NetworkEndpoint.evalArray(value ?? []);
    }

    /**
     * Host handling instances, or `null` to have no configured hosts. On input,
     * this is expected to be an object suitable as an argument to {@link
     * BaseComponent#evalArray} (see which).
     *
     * @param {?object|Array<NetworkHost|NetworkHost.Config>} [value] Proposed
     *   configuration value. Default `null`.
     * @returns {Array<NetworkHost>} Accepted configuration value.
     */
    _config_hosts(value = null) {
      return NetworkHost.evalArray(value ?? []);
    }

    /**
     * Service instances, or `null` to have no configured services. On input,
     * this is expected to be an object suitable as an argument to {@link
     * BaseComponent#evalArray} (see which).
     *
     * @param {?object|Array<BaseService|BaseService.Config>} [value] Proposed
     *   configuration value. Default `null`.
     * @returns {Array<BaseService>} Accepted configuration value.
     */
    _config_services(value = null) {
      return BaseService.evalArray(value ?? []);
    }
  };
}
