// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PromiseUtil } from '@this/async';
import { WallClock } from '@this/clocks';
import { BaseComponent, BaseConfig, ControlContext, RootControlContext }
  from '@this/compote';

import { BaseApplication } from '#x/BaseApplication';
import { BaseService } from '#x/BaseService';
import { ComponentManager } from '#x/ComponentManager';
import { HostManager } from '#x/HostManager';
import { NetworkEndpoint } from '#x/NetworkEndpoint';
import { NetworkHost } from '#x/NetworkHost';
import { ThisModule } from '#p/ThisModule';


/**
 * Root component which contains all the subcomponents required to operate a
 * specific web application.
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
    super(rawConfig, new RootControlContext(ThisModule.subsystemLogger('warehouse')));

    const { applications, endpoints, hosts, services } = this.config;

    this.#applicationManager = new ComponentManager(applications, {
      baseClass:     BaseApplication,
      baseSublogger: ThisModule.cohortLogger('app')
    });

    this.#serviceManager = new ComponentManager(services, {
      baseClass:     BaseService,
      baseSublogger: ThisModule.cohortLogger('service')
    });

    this.#endpointManager = new ComponentManager(endpoints, {
      baseClass:     NetworkEndpoint,
      baseSublogger: ThisModule.cohortLogger('endpoint')
    });

    this.#hostManager = new HostManager(hosts);
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
  async _impl_init(isReload) {
    const callInit = (name, obj) => {
      const context = new ControlContext(obj, this, ThisModule.subsystemLogger(name));
      return obj.init(context, isReload);
    };

    const results = [
      callInit('services',  this.#serviceManager),
      callInit('apps',      this.#applicationManager),
      callInit('hosts',     this.#hostManager),
      callInit('endpoints', this.#endpointManager)
    ];

    await Promise.all(results);
  }

  /** @override */
  async _impl_start(isReload = false) {
    await this.#hostManager.start(isReload);
    await this.#serviceManager.start(isReload);
    await this.#applicationManager.start(isReload);
    await this.#endpointManager.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload = false) {
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
  static #Config = class Config extends BaseConfig {
    /**
     * Application instances.
     *
     * @type {Array<BaseApplication>}
     */
    #applications;

    /**
     * Host handling instances.
     *
     * @type {Array<NetworkHost>}
     */
    #hosts;

    /**
     * Endpoint instances.
     *
     * @type {Array<NetworkEndpoint>}
     */
    #endpoints;

    /**
     * Service instances.
     *
     * @type {Array<BaseService>}
     */
    #services;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Configuration object. See class header for
     *   details.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        applications,
        endpoints,
        hosts = [],
        services = []
      } = rawConfig;

      this.#applications = BaseApplication.evalArray(applications);
      this.#hosts        = NetworkHost.evalArray(hosts);
      this.#endpoints    = NetworkEndpoint.evalArray(endpoints);
      this.#services     = BaseService.evalArray(services);
    }

    /** @returns {Array<BaseApplication>} Application instances. */
    get applications() {
      return this.#applications;
    }

    /** @returns {Array<NetworkHost>} Host handling instances. */
    get hosts() {
      return this.#hosts;
    }

    /** @returns {Array<NetworkEndpoint>} Endpoint instances. */
    get endpoints() {
      return this.#endpoints;
    }

    /** @returns {Array<BaseService>} Service instances. */
    get services() {
      return this.#services;
    }
  };
}
