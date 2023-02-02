// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '#x/ApplicationConfig';
import { BaseConfig } from '#x/BaseConfig';
import { ConfigClassMapper } from '#x/ConfigClassMapper';
import { HostConfig } from '#x/HostConfig';
import { ServerConfig } from '#x/ServerConfig';
import { ServiceConfig } from '#x/ServiceConfig';


/**
 * Configuration representation for the "warehouse" (the entire system).
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * `{object|object[]} applications` -- Application configuration.
 * * `{object|object[]} hosts` -- Optional host / certificate configuration.
 *   Required only if a server is configured to listen for secure connections.
 * * `{object|object[]} servers` -- Server configuration.
 * * `{object|object[]} services` -- System service configuration.
 */
export class WarehouseConfig extends BaseConfig {
  /** @type {ApplicationConfig[]} Application configuration objects. */
  #applications;

  /** @type {HostConfig[]} Host configuration objects. */
  #hosts;

  /** @type {ServerConfig[]} Server configuration objects. */
  #servers;

  /** @type {ServiceConfig[]} Service configuration objects. */
  #services;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   * @param {ConfigClassMapper} configClassMapper Mapper from configuration
   *   objects to corresponding configuration classes.
   */
  constructor(config, configClassMapper) {
    super(config);

    const {
      applications,
      hosts = [],
      servers,
      services
    } = config;

    this.#applications = ApplicationConfig.parseArray(applications, configClassMapper);
    this.#hosts        = HostConfig.parseArray(hosts, configClassMapper);
    this.#servers      = ServerConfig.parseArray(servers, configClassMapper);
    this.#services     = ServiceConfig.parseArray(services, configClassMapper);
  }

  /** @returns {ApplicationConfig[]} Application configuration objects. */
  get applications() {
    return this.#applications;
  }

  /** @returns {HostConfig[]} Host configuration objects. */
  get hosts() {
    return this.#hosts;
  }

  /** @returns {ServerConfig[]} Server configuration objects. */
  get servers() {
    return this.#servers;
  }

  /** @returns {ServiceConfig[]} Service configuration objects. */
  get services() {
    return this.#services;
  }
}
