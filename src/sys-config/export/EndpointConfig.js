// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseNamedConfig, Names } from '@this/compote';
import { HostUtil, UriUtil } from '@this/net-util';

import { ServiceUseConfig } from '#x/ServiceUseConfig';
import { Util } from '#x/Util';


/**
 * Configuration representation for an endpoint item, that is, the thing that
 * answers network requests and routes them to an application, and which can
 * also be hooked up to one or more auxiliary services.
 *
 * See `doc/configuration.md` for configuration object details.
 */
export class EndpointConfig extends BaseNamedConfig {
  /**
   * Name of the application to send requests to.
   *
   * @type {string}
   */
  #application;

  /**
   * The hostnames in question.
   *
   * @type {Array<string>}
   */
  #hostnames;

  /**
   * Physical interface to listen on; this is the result of a call to {@link
   * UriUtil#parseInterface}.
   *
   * @type {object}
   */
  #interface;

  /**
   * High-level protocol to speak.
   *
   * @type {string}
   */
  #protocol;

  /**
   * Role-to-service mappings.
   *
   * @type {ServiceUseConfig}
   */
  #services;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const {
      hostnames = '*',
      interface: iface, // `interface` is a reserved word.
      application,
      protocol,
      services = {}
    } = rawConfig;

    this.#hostnames = Util.checkAndFreezeStrings(
      hostnames,
      (item) => HostUtil.checkHostname(item, true));

    this.#interface   = Object.freeze(HostUtil.parseInterface(iface));
    this.#application = Names.checkName(application);
    this.#protocol    = UriUtil.checkProtocol(protocol);
    this.#services    = new ServiceUseConfig(services);
  }

  /** @returns {string} Name of the application to send requests to. */
  get application() {
    return this.#application;
  }

  /**
   * @returns {Array<string>} List of hostnames, including possibly subdomain
   * and/or full wildcards.
   */
  get hostnames() {
    return this.#hostnames;
  }

  /**
   * @returns {object} Parsed interface. This is a frozen return value from
   * {@link UriUtil#parseInterface}.
   */
  get interface() {
    return this.#interface;
  }

  /** @returns {string} High-level protocol to speak. */
  get protocol() {
    return this.#protocol;
  }

  /** @returns {ServiceUseConfig} Role-to-service configuration. */
  get services() {
    return this.#services;
  }

  /**
   * Indicates whether the protocol requires host certificate configuration.
   *
   * @returns {boolean} `true` iff certificates are required.
   */
  requiresCertificates() {
    return this.#protocol !== 'http';
  }
}
