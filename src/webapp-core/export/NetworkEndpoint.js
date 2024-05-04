// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { BaseComponent, Names } from '@this/compy';
import { FormatUtils } from '@this/loggy-intf';
import { IntfAccessLog, IntfConnectionRateLimiter, IntfDataRateLimiter,
  ProtocolWrangler, ProtocolWranglers }
  from '@this/net-protocol';
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
        accessLog:             accessLogName             = null,
        dataRateLimiter:       dataRateLimiterName       = null,
        connectionRateLimiter: connectionRateLimiterName = null
      }
    } = this.config;

    const dataRateLimiter = dataRateLimiterName
      ? serviceManager.get(dataRateLimiterName, IntfDataRateLimiter)
      : null;
    const connectionRateLimiter = connectionRateLimiterName
      ? serviceManager.get(connectionRateLimiterName, IntfConnectionRateLimiter)
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
      connectionRateLimiter,
      dataRateLimiter,
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
    return class Config extends BaseComponent.Config {
      // @defaultConstructor

      /**
       * Indicates whether the protocol requires host certificate configuration.
       *
       * @returns {boolean} `true` iff certificates are required.
       */
      requiresCertificates() {
        return this.protocol !== 'http';
      }

      /**
       * Name of the application to send requests to.
       *
       * @param {string} value Proposed configuration value.
       * @returns {string} Accepted configuration value.
       */
      _config_application(value) {
        return Names.checkName(value);
      }

      /**
       * List of hostnames to recognize as valid, including possibly subdomain
       * wildcards and/or a full wildcard.
       *
       * @param {string|Array<string>} [value] Proposed configuration value.
       *   Default `'*'`.
       * @returns {Array<string>} Accepted configuration value.
       */
      _config_hostnames(value = '*') {
        return StringUtil.checkAndFreezeStrings(
          value,
          (item) => HostUtil.checkHostname(item, true));
      }

      /**
       * Interface to listen on. When passed in, this is expected to be a string
       * which can be parsed by {@link UriUtil#parseInterface}.
       *
       * @param {string} value Proposed configuration value.
       * @returns {object} Accepted configuration value, as parsed by {@link
       *   UriUtil#parseInterface}.
       */
      _config_interface(value) {
        return Object.freeze(HostUtil.parseInterface(value));
      }

      /**
       * High-level protocol to speak. Accepted values are `http`, `http2`, and
       * `https`.
       *
       * @param {string} value Proposed configuration value.
       * @returns {string} Accepted configuration value.
       */
      _config_protocol(value) {
        return ProtocolWranglers.checkProtocol(value);
      }

      /**
       * Role-to-service configuration. When passed in, this is expected to be a
       * plain object that can be parsed by the {@link ServiceUseConfig}
       * constructor.
       *
       * @param {object} [value] Proposed configuration value. Default `{}`
       *   (that is, no services).
       * @returns {ServiceUseConfig} Accepted configuration value.
       */
      _config_services(value = {}) {
        return new ServiceUseConfig(value);
      }
    };
  }
}
