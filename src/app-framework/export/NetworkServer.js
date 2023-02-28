// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MountConfig, ServerConfig } from '@this/app-config';
import { TreePathKey, TreePathMap } from '@this/collections';
import { IntfLogger } from '@this/loggy';
import { IntfRateLimiter, IntfRequestLogger, ProtocolWrangler,
  ProtocolWranglers, WranglerContext }
  from '@this/network-protocol';
import { MustBe } from '@this/typey';

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
 */
export class NetworkServer extends BaseComponent {
  /**
   * @type {HostManager} Host manager with bindings for all valid hostnames for
   * this instance.
   */
  #hostManager;

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
   * @param {ServerConfig} config Parsed configuration item.
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
    const { endpoint, mounts, name }           = config;
    const { interface: iface, port, protocol } = endpoint;

    const { applicationMap, hostManager, logger, rateLimiter, requestLogger } = extraConfig;

    super(config, ThisModule.logger.endpoint[name]);

    this.#hostManager = hostManager;
    this.#mountMap    = NetworkServer.#makeMountMap(mounts, applicationMap);

    const wranglerOptions = {
      rateLimiter,
      requestHandler: (req, res) => this.#handleRequest(req, res),
      requestLogger,
      logger,
      protocol,
      socket: { host: iface, port },
      ...(
        this.#hostManager
          ? { hosts: this.#hostManager.secureServerOptions }
          : {})
    };

    this.#wrangler = ProtocolWranglers.make(wranglerOptions);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    await this.#wrangler.start();
  }

  /**
   * **Note:** This returns when the endpoint is actually stopped, with the
   * server socket closed.
   *
   * @override
   */
  async _impl_stop(willReload_unused) {
    await this.#wrangler.stop();
  }

  /**
   * Handles a request dispatched from Express (or similar). Parameters are as
   * defined by the Express middleware spec.
   *
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @returns {boolean} Was the request handled?
   */
  async #handleRequest(req, res) {
    const reqLogger = WranglerContext.get(req)?.logger;

    const { path, subdomains } = req;

    // Freezing `subdomains` lets `new TreePathKey()` avoid making a copy.
    const hostKey = new TreePathKey(Object.freeze(subdomains), false);
    const pathKey = NetworkServer.#parsePath(path);

    // Find the mount map for the most-specific matching host.
    const hostMatch = this.#mountMap.find(hostKey);
    if (!hostMatch) {
      // No matching host.
      reqLogger?.hostNotFound(hostKey);
      return false;
    }

    // Iterate from most- to least-specific mounted path.
    for (let pathMatch = hostMatch.value.find(pathKey, true);
      pathMatch;
      pathMatch = pathMatch.next) {
      const application = pathMatch.value;

      // Thwack the salient context into `req`; it gets restored after the
      // application runs. This setup is analogous to what Express does when
      // routing, but we have to do it ourselves here because Express is running
      // our whole dispatch system as just a single Express middleware call.

      const { baseUrl: origBaseUrl, url: origUrl } = req;
      const baseUrlExtra = (pathMatch.key.length === 0)
        ? ''
        : TreePathKey.uriPathStringFrom(pathMatch.key, false);

      req.baseUrl = `${origBaseUrl}${baseUrlExtra}`;
      req.url     = TreePathKey.uriPathStringFrom(pathMatch.keyRemainder);

      reqLogger?.dispatching({
        application: application.name,
        host:        TreePathKey.hostnameStringFrom(hostMatch.key),
        path:        TreePathKey.uriPathStringFrom(pathMatch.key),
        url:         req.url
      });

      try {
        if (await application.handleRequest(req, res)) {
          return true;
        }
      } finally {
        // Restore `req`. See big comment above.
        req.baseUrl = origBaseUrl;
        req.url     = origUrl;
      }
    }

    // No mounted path actually handled the request.
    reqLogger?.pathNotFound(pathKey);
    return false;
  }


  //
  // Static members.
  //

  /** @override */
  static get CONFIG_CLASS() {
    return ServerConfig;
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

  /**
   * Parses a path into a non-wildcard key. The only syntactic check performed
   * by this method is to ensure that `path` begins with a slash (`/`).
   *
   * **Note:** The result will have an empty-string path component at the
   * end if the given `path` ends with a slash.
   *
   * @param {string} path Path to parse.
   * @returns {TreePathKey} Parsed form.
   * @throws {Error} Thrown if `path` is not valid.
   */
  static #parsePath(path) {
    MustBe.string(path, /^[/]/);

    const parts = path.split('/');
    parts.shift(); // Shift off the empty component from the initial slash.

    // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
    return new TreePathKey(Object.freeze(parts), false);
  }
}
