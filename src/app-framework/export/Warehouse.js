// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig, ServiceConfig, WarehouseConfig } from '@this/app-config';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { ApplicationManager } from '#x/ApplicationManager';
import { HostManager } from '#x/HostManager';
import { ServerManager } from '#x/ServerManager';
import { ServiceFactory } from '#x/ServiceFactory';
import { ServiceManager } from '#x/ServiceManager';


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
 * * `{boolean} isReload` -- Is the system being reloaded in-process? Default
 *   `false`.
 */
export class Warehouse {
  /** @type {ApplicationManager} Application manager. */
  #applicationManager;

  /** @type {?HostManager} Host manager, if configured. */
  #hostManager;

  /** @type {ServerManager} Server manager, for all server bindings. */
  #serverManager;

  /** @type {ServiceManager} Service manager. */
  #serviceManager;

  /** @type {boolean} Is the system being reloaded in-process? */
  #isReload;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
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
    this.#isReload           = parsed.isReload;
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

  /**
   * Indicates that the system is going to be reloaded.
   */
  willReload() {
    this.#isReload = true;
  }

  /**
   * Starts all applications. This async-returns once all applications are
   * started.
   *
   * @throws {Error} Thrown if any application had trouble starting.
   */
  async startAllApplications() {
    const applications = this.#applicationManager.getAll();
    //const results      = applications.map((s) => s.start());
    const results = null; // TODO

    return Promise.all(results);
  }

  /**
   * Stops all applications. This async-returns once all applications are
   * stopped.
   *
   * @throws {Error} Thrown if any application had trouble stopping.
   */
  async stopAllApplications() {
    const applications = this.#applicationManager.getAll();
    //const results      = applications.map((s) => s.stop());
    const results = null; // TODO

    return Promise.all(results);
  }

  /**
   * Starts all servers. This async-returns once all servers are started.
   *
   * @throws {Error} Thrown if any server had trouble starting.
   */
  async startAllServers() {
    const servers = this.#serverManager.getAll();
    const results = servers.map((s) => s.start());

    return Promise.all(results);
  }

  /**
   * Stops all servers. This async-returns once all servers are stopped.
   *
   * @throws {Error} Thrown if any server had trouble stopping.
   */
  async stopAllServers() {
    const servers = this.#serverManager.getAll();
    const results = servers.map((s) => s.stop());

    return Promise.all(results);
  }

  /**
   * Starts all services. This async-returns once all services are started.
   *
   * @throws {Error} Thrown if any service had trouble starting.
   */
  async startAllServices() {
    const services = this.#serviceManager.getAll();
    const results  = services.map((s) => s.start(this.#isReload));

    return Promise.all(results);
  }

  /**
   * Stops all services. This async-returns once all services are stopped.
   *
   * @throws {Error} Thrown if any server had trouble stopping.
   */
  async stopAllServices() {
    const services = this.#serviceManager.getAll();
    const results  = services.map((s) => s.stop(this.#isReload));

    return Promise.all(results);
  }
}
