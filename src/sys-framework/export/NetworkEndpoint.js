// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey, TreePathMap } from '@this/collections';
import { IntfRateLimiter, IntfRequestLogger, ProtocolWrangler,
  ProtocolWranglers }
  from '@this/net-protocol';
import { DispatchInfo, IntfRequestHandler, OutgoingResponse }
  from '@this/net-util';
import { EndpointConfig, MountConfig } from '@this/sys-config';

import { BaseApplication } from '#x/BaseApplication';
import { BaseComponent } from '#x/BaseComponent';
import { HostManager } from '#x/HostManager';


/**
 * Component (in the sense of this module) which completely handles a single
 * network endpoint. Instances of this class have a {@link ProtocolWrangler} to
 * deal with the lower-level networking details and a map from mount points to
 * {@link BaseApplication} instances. This class is the connection between these
 * two things.
 *
 * @implements {IntfRequestHandler}
 */
export class NetworkEndpoint extends BaseComponent {
  /**
   * @type {?BaseApplication} Application to send requests to. Becomes
   * non-`null` during {@link #_impl_start()}.
   */
  #application = null;

  /** @type {ProtocolWrangler} Protocol-specific "wrangler." */
  #wrangler;


  /**
   * Constructs an instance. The `extraConfig` argument contains additional
   * bindings, to serve as "environment-bound" values that serve as replacements
   * for what was passed in the original (but unbound) `config` (along with
   * other bits):
   *
   * @param {EndpointConfig} config Parsed configuration item.
   * @param {object} extraConfig Additional configuration.
   * @param {Map<string, BaseApplication>} extraConfig.applicationMap Map of
   *   names to applications, for use in building the active mount map.
   * @param {?HostManager} extraConfig.hostManager Replacement for `hostnames`.
   * @param {?IntfRateLimiter} extraConfig.rateLimiter Replacement for
   *   `rateLimiter` (service instance, not just a name).
   * @param {?IntfRequestLogger} extraConfig.requestLogger Replacement for
   *   `rateLimiter` (service instance, not just a name).
   */
  constructor(config, extraConfig) {
    const { interface: iface, protocol } = config;
    const { hostManager, rateLimiter, requestLogger } = extraConfig;

    super(config);

    const wranglerOptions = {
      rateLimiter,
      requestHandler: this,
      requestLogger,
      protocol,
      interface: iface,
      ...(
        hostManager
          ? { hostManager }
          : {})
    };

    this.#wrangler = ProtocolWranglers.make(wranglerOptions);
  }

  /**
   * **Note:** The second argument (`dispatch`) is expected to always be passed
   * in as `null` here, so we can safely ignore it.
   *
   * @override
   */
  async handleRequest(request, dispatch_unused) {
    const application = this.#application;
    const dispatch    = new DispatchInfo(TreePathKey.EMPTY, request.pathname);

    request.logger?.dispatching(application.name);

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
  async _impl_init(isReload) {
    await this.#wrangler.init(this.logger, isReload);
  }

  /** @override */
  async _impl_start(isReload) {
    this.#application =
      this.context.getComponent(this.config.application, BaseApplication);

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
  static get CONFIG_CLASS() {
    return EndpointConfig;
  }

  /**
   * Makes the map from each (possibly wildcarded) hostname that this endpoint
   * handles to the map from each (typically wildcarded) path (that is, a path
   * _prefix_ when wildcarded) to the application which handles it.
   *
   * @param {MountConfig[]} mounts Configured application mounts.
   * @param {Map<string, BaseApplication>} applicationMap Map from application
   *   names to corresponding instances.
   * @returns {TreePathMap<TreePathMap<BaseApplication>>} The constructed mount
   *   map.
   */
  static #makeMountMap(mounts, applicationMap) {
    const result = new TreePathMap(TreePathKey.hostnameStringFrom);

    for (const mount of mounts) {
      const { application, hostname, path } = mount;

      let hostMounts = result.get(hostname);
      if (!hostMounts) {
        hostMounts = new TreePathMap(TreePathKey.uriPathStringFrom);
        result.add(hostname, hostMounts);
      }

      hostMounts.add(path, applicationMap.get(application));
    }

    return result;
  }
}
