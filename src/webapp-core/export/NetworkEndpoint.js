// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { BaseComponent, BaseConfig, Names } from '@this/compy';
import { FormatUtils } from '@this/loggy-intf';
import { IntfAccessLog, IntfDataRateLimiter, IntfRateLimiter, ProtocolWrangler,
  ProtocolWranglers } from '@this/net-protocol';
import { DispatchInfo, FullResponse, HostUtil, IntfRequestHandler, UriUtil }
  from '@this/net-util';
import { StringUtil } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { ServiceUseConfig } from '#p/ServiceUseConfig';


/**
 * Component (in the sense of `compy`) which completely handles a single network
 * endpoint. Instances of this class have a {@link ProtocolWrangler} to deal
 * with the lower-level networking details and a map from mount points to {@link
 * BaseApplication} instances. This class is the connection between these two
 * things.
 *
 * @implements {IntfRequestHandler}
 */
export class NetworkEndpoint extends BaseComponent {
  /**
   * Application to send requests to. Becomes non-`null` during {@link
   * #_impl_start()}.
   *
   * @type {?BaseApplication}
   */
  #application = null;

  /**
   * Protocol-specific "wrangler" or `null` if not yet set up. This gets set in
   * {@link #_impl_start}.
   *
   * @type {?ProtocolWrangler}
   */
  #wrangler = null;

  // @defaultConstructor

  /**
   * **Note:** The second argument (`dispatch`) is expected to always be passed
   * in as `null` here, so we can safely ignore it.
   *
   * @override
   */
  async handleRequest(request, dispatch_unused) {
    const application = this.#application;
    const dispatch    = new DispatchInfo(PathKey.EMPTY, request.pathname);

    try {
      const result = await application.handleRequest(request, dispatch);
      if ((result === null) || (result instanceof FullResponse)) {
        return result;
      } else {
        // Caught immediately below.
        const type = ((typeof result === 'object') || (typeof result === 'function'))
          ? result.constructor.name
          : typeof result;
        throw new Error(`Unexpected result type from \`handleRequest()\`: ${type}`);
      }
    } catch (e) {
      request.logger?.applicationError(e);
    }

    return null;
  }

  /** @override */
  async _impl_init() {
    const {
      application,
      interface: iface,
      protocol
    } = this.config;

    this.logger?.routing({
      protocol,
      interface: FormatUtils.networkInterfaceString(iface),
      application
    });
  }

  /** @override */
  async _impl_start() {
    const appManager     = this.root.applicationManager;
    const serviceManager = this.root.serviceManager;

    const {
      application,
      hostnames,
      interface: iface,
      protocol,
      services: {
        accessLog:       accessLogName       = null,
        dataRateLimiter: dataRateLimiterName = null,
        rateLimiter:     rateLimiterName     = null
      }
    } = this.config;

    const dataRateLimiter = dataRateLimiterName
      ? serviceManager.get(dataRateLimiterName, IntfDataRateLimiter)
      : null;
    const rateLimiter = rateLimiterName
      ? serviceManager.get(rateLimiterName, IntfRateLimiter)
      : null;
    const accessLog = accessLogName
      ? serviceManager.get(accessLogName, IntfAccessLog)
      : null;

    const hmOpt = {};
    if (this.config.requiresCertificates()) {
      const hostManager = this.root.hostManager;
      hmOpt.hostManager = hostManager.makeSubset(hostnames);
    }

    const wranglerOptions = {
      accessLog,
      dataRateLimiter,
      rateLimiter,
      requestHandler: this,
      protocol,
      interface: iface,
      ...hmOpt
    };

    this.#application = appManager.get(application);
    this.#wrangler    = ProtocolWranglers.make(wranglerOptions);

    await this.#wrangler.init(this.logger);
    await this.#wrangler.start();
  }

  /**
   * **Note:** This returns when the endpoint is actually stopped, with the
   * server socket closed.
   *
   * @override
   */
  async _impl_stop(willReload) {
    await this.#wrangler.stop(willReload);
  }


  //
  // Static members.
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseConfig {
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
      super(rawConfig, true /* require `name` */);

      const {
        hostnames = '*',
        interface: iface, // `interface` is a reserved word.
        application,
        protocol,
        services = {}
      } = rawConfig;

      this.#hostnames = StringUtil.checkAndFreezeStrings(
        hostnames,
        (item) => HostUtil.checkHostname(item, true));

      this.#interface   = Object.freeze(HostUtil.parseInterface(iface));
      this.#application = Names.checkName(application);
      this.#protocol    = ProtocolWranglers.checkProtocol(protocol);
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
  };
}
