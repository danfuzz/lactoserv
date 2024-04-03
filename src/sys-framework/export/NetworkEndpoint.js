// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { BaseComponent, BaseNamedConfig, Names } from '@this/compote';
import { FormatUtils } from '@this/loggy-intf';
import { IntfRateLimiter, IntfAccessLog, ProtocolWrangler,
  ProtocolWranglers }
  from '@this/net-protocol';
import { DispatchInfo, HostUtil, IntfRequestHandler, OutgoingResponse, UriUtil }
  from '@this/net-util';
import { StringUtil } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { BaseService } from '#x/BaseService';
import { ServiceUseConfig } from '#p/ServiceUseConfig';


/**
 * Component (in the sense of `compote`) which completely handles a single
 * network endpoint. Instances of this class have a {@link ProtocolWrangler} to
 * deal with the lower-level networking details and a map from mount points to
 * {@link BaseApplication} instances. This class is the connection between these
 * two things.
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
    const dispatch    = new DispatchInfo(TreePathKey.EMPTY, request.pathname);

    try {
      const result = await application.handleRequest(request, dispatch);
      if ((result === null) || (result instanceof OutgoingResponse)) {
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
  async _impl_init(isReload_unused) {
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
  async _impl_start(isReload) {
    const context = this.context;

    const {
      application,
      hostnames,
      interface: iface,
      protocol,
      services: {
        rateLimiter:   rateLimiterName = null,
        requestLogger: requestLoggerName = null
      }
    } = this.config;

    const rateLimiter   = context.getComponentOrNull(rateLimiterName,   BaseService, IntfRateLimiter);
    const requestLogger = context.getComponentOrNull(requestLoggerName, BaseService, IntfAccessLog);

    const hmOpt = {};
    if (this.config.requiresCertificates()) {
      const hostManager = this.context.getComponent('hostManager');
      hmOpt.hostManager = hostManager.makeSubset(hostnames);
    }

    const wranglerOptions = {
      rateLimiter,
      requestHandler: this,
      requestLogger,
      protocol,
      interface: iface,
      ...hmOpt
    };

    this.#application = context.getComponent(application, BaseApplication);
    this.#wrangler    = ProtocolWranglers.make(wranglerOptions);

    await this.#wrangler.init(this.logger, isReload);
    await this.#wrangler.start(isReload);
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
  static #Config = class Config extends BaseNamedConfig {
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

      this.#hostnames = StringUtil.checkAndFreezeStrings(
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
  };
}
