// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { Names } from '@this/compy';
import { IntfAccessLog, IntfConnectionRateLimiter, IntfDataRateLimiter,
  ProtocolWrangler, ProtocolWranglers }
  from '@this/net-protocol';
import { BaseResponse, DispatchInfo, EndpointAddress, HostUtil,
  InterfaceAddress, IntfRequestHandler }
  from '@this/net-util';
import { ByteCount } from '@this/quant';
import { StringUtil } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { BaseDispatched } from '#x/BaseDispatched';
import { ServiceUseConfig } from '#p/ServiceUseConfig';


/**
 * Component (in the sense of `compy`) which completely handles a single network
 * endpoint. Instances of this class have a {@link ProtocolWrangler} to deal
 * with the lower-level networking details and a map from mount points to
 * {@link BaseApplication} instances. This class is the connection between these
 * two things.
 *
 * @implements {IntfRequestHandler}
 */
export class NetworkEndpoint extends BaseDispatched {
  /**
   * Application to send requests to. Becomes non-`null` during
   * {@link #_impl_start()}.
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
    const dispLogger  = this._prot_newDispatchLogger(request?.id);
    const dispatch    = new DispatchInfo(PathKey.EMPTY, request.pathname, dispLogger);

    dispLogger?.dispatching({
      application: application.name,
      ...dispatch.infoForLog
    });

    try {
      const result = await application.handleRequest(request, dispatch);
      if ((result === null) || (result instanceof BaseResponse)) {
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
      interface: EndpointAddress.networkInterfaceString(iface),
      application
    });

    await super._impl_init();
  }

  /** @override */
  async _impl_start() {
    const appManager     = this.root.applicationManager;
    const serviceManager = this.root.serviceManager;

    const {
      application,
      hostnames,
      interface: iface,
      maxRequestBodySize,
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
    const maxRequestBodyBytes = maxRequestBodySize
      ? maxRequestBodySize.byte
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
      maxRequestBodyBytes,
      requestHandler: this,
      protocol,
      interface: iface,
      ...hmOpt
    };

    this.#application = appManager.get(application);
    this.#wrangler    = ProtocolWranglers.make(wranglerOptions);

    await this.#wrangler.init(this.logger);
    await this.#wrangler.start();
    await super._impl_start();
  }

  /**
   * **Note:** This returns when the endpoint is actually stopped, with the
   * server socket closed.
   *
   * @override
   */
  async _impl_stop(willReload) {
    await this.#wrangler.stop(willReload);
    await super._impl_stop(willReload);
  }


  //
  // Static members.
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
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
       * or object which can be passed to {@link InterfaceAddress#constructor}.
       *
       * @param {string|object} value Proposed configuration value.
       * @returns {object} Accepted configuration value.
       */
      _config_interface(value) {
        return Object.freeze(InterfaceAddress.parseInterface(value));
      }

      /**
       * Maximum allowed size of a request body, or `null` to not have such a
       * size limit. if so limited. If passed as a string, it is parsed by
       * {@link ByteCount#parse}.
       *
       * @param {?string|ByteCount} [value] Proposed configuration value.
       *   Default `null`.
       * @returns {?ByteCount} Accepted configuration value.
       */
      _config_maxRequestBodySize(value = null) {
        if (value === null) {
          return null;
        }

        const result = ByteCount.parse(value, { range: { minInclusive: 0 } });

        if (result === null) {
          throw new Error(`Could not parse \`maxRequestBodySize\`: ${value}`);
        }

        return result;
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
