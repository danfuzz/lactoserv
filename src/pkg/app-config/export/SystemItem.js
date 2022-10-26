// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseConfigurationItem } from '#x/BaseConfigurationItem';
import { ConfigClassMapper } from '#x/ConfigClassMapper';
import { ApplicationItem } from '#x/ApplicationItem';
import { HostItem } from '#x/HostItem';
import { ServerItem } from '#x/ServerItem';
import { ServiceItem } from '#x/ServiceItem';


/**
 * Configuration representation for the entire system.
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * `{object|object[]} applications` -- Application configuration.
 * * `{object|object[]} hostnames` -- Optional host / certificate configuration.
 *   Required only if a server is configured to listen for secure connections.
 * * `{object|object[]} servers` -- Server configuration.
 * * `{object|object[]} services` -- System service configuration.
 */
export class SystemItem extends BaseConfigurationItem {
  /** @type {ApplicationItem[]} Application configuration objects. */
  #applications;

  /** @type {?HostItem[]} Hostname configuration objects, if any. */
  #hostnames;

  /** @type {ServerItem[]} Server configuration objects. */
  #servers;

  /** @type {ServiceItem[]} Service configuration objects. */
  #services;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   * @param {ConfigClassMapper} configClassMapper Mapper from configuration
   *   objects to corresponding configuration classes.
   */
  constructor(config, configClassMapper) {
    super(config);

    const {
      applications,
      hostnames = null,
      servers,
      services
    } = config;

    this.#applications = ApplicationItem.parseArray(applications, configClassMapper);
    this.#hostnames    = HostItem.parseArrayOrNull(hostnames, configClassMapper);
    this.#servers      = ServerItem.parseArray(servers, configClassMapper);
    this.#services     = ServiceItem.parseArray(services, configClassMapper);
  }

  /** @returns {ApplicationItem[]} Application configuration objects. */
  get applications() {
    return this.#applications;
  }

  /** @returns {?HostItem[]} Hostname configuration objects, if any. */
  get hostnames() {
    return this.#hostnames;
  }

  /** @returns {ServerItem[]} Server configuration objects. */
  get servers() {
    return this.#servers;
  }

  /** @returns {ServiceItem[]} Service configuration objects. */
  get services() {
    return this.#services;
  }
}
