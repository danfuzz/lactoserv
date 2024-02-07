// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey, TreePathMap } from '@this/collections';
import { IntfLogger } from '@this/loggy';
import { DispatchInfo, IntfRateLimiter, IntfRequestHandler, IntfRequestLogger,
  ProtocolWrangler, ProtocolWranglers }
  from '@this/net-protocol';
import { EndpointConfig, MountConfig } from '@this/sys-config';

import { BaseApplication } from '#x/BaseApplication';
import { BaseComponent } from '#x/BaseComponent';
import { HostManager } from '#x/HostManager';
import { ThisModule } from '#p/ThisModule';


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
   * @type {TreePathMap<TreePathMap<BaseApplication>>} Map from hostnames to
   * map from paths to applications. See {@link #makeMountMap} for details.
   */
  #mountMap;

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
   * @param {?IntfLogger} extraConfig.logger Logger to use for reporting network
   *   activity, or `null not to do any logging.
   * @param {?IntfRateLimiter} extraConfig.rateLimiter Replacement for
   *   `rateLimiter` (service instance, not just a name).
   * @param {?IntfRequestLogger} extraConfig.requestLogger Replacement for
   *   `rateLimiter` (service instance, not just a name).
   */
  constructor(config, extraConfig) {
    const { interface: iface, mounts, name, protocol } = config;
    const { applicationMap, hostManager, logger, rateLimiter, requestLogger } = extraConfig;

    super(config, ThisModule.logger.endpoint[name]);

    this.#mountMap = NetworkEndpoint.#makeMountMap(mounts, applicationMap);

    const wranglerOptions = {
      rateLimiter,
      requestHandler: this,
      requestLogger,
      logger,
      protocol,
      interface: iface,
      ...(
        hostManager
          ? { hostManager }
          : {})
    };

    this.#wrangler = ProtocolWranglers.make(wranglerOptions);

    if (logger) {
      const mountMap = {};

      for (const [host, hostMounts] of this.#mountMap) {
        const hostString = host.toHostnameString();
        const paths      = {};
        for (const [path, app] of hostMounts) {
          paths[path.toUriPathString(true)] = app.name;
        }
        mountMap[hostString] = paths;
      }

      logger.mounts(mountMap);
    }
  }

  /**
   * **Note:** The second argument (`dispatch`) is expected to always be passed
   * in as `null` here, so we can safely ignore it.
   *
   * @override
   */
  async handleRequest(request, dispatch_unused) {
    // Find the mount map for the most-specific matching host.
    const hostMatch = this.#mountMap.find(request.host.nameKey);
    if (!hostMatch) {
      // No matching host.
      request.logger?.hostNotFound(request.host.nameString);
      return false;
    }

    // Iterate from most- to least-specific mounted path.
    for (let pathMatch = hostMatch.value.find(request.pathname, true);
      pathMatch;
      pathMatch = pathMatch.next) {
      const application = pathMatch.value;
      const dispatch = new DispatchInfo(pathMatch.key, pathMatch.keyRemainder);

      request.logger?.dispatching({
        application: application.name,
        host:        hostMatch.key.toHostnameString(),
        base:        dispatch.baseString,
        extra:       dispatch.extraString
      });

      try {
        if (await application.handleRequest(request, dispatch)) {
          return true;
        }
      } catch (e) {
        request.logger?.applicationError(e);
      }
    }

    // No mounted path actually handled the request.
    request.logger?.pathNotFound(request.pathname);
    return false;
  }

  /** @override */
  async _impl_start(isReload) {
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
