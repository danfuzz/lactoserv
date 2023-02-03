// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MountConfig, ServerConfig } from '@this/app-config';
import { TreePathKey, TreePathMap } from '@this/collections';
import { ProtocolWrangler, ProtocolWranglers, WranglerContext } from '@this/network-protocol';
import { MustBe } from '@this/typey';

import { ApplicationController } from '#x/ApplicationController';
import { BaseApplication } from '#x/BaseApplication';
import { BaseController } from '#x/BaseController';
import { HostManager } from '#x/HostManager';


/**
 * "Controller" for a single server. Instances of this class wrap both a
 * (concrete subclass of a) {@link net.Server} object _and_ an
 * `express.Application` (or equivalent) which _exclusively_ handles that
 * server.
 */
export class ServerController extends BaseController {
  /**
   * @type {HostManager} Host manager with bindings for all valid hostnames for
   * this instance.
   */
  #hostManager;

  /**
   * @type {TreePathMap<TreePathMap<ApplicationController>>} Map from hostnames
   * to paths to application controllers. See {@link #makeMountMap} for details.
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
   * * `{Map<string,BaseApplication>} applicationMap` -- Map of names to
   *   applications, for use in building the active mount map.
   * * `{?HostManager} hostManager` -- Replacement for `hostnames`.
   * * `{function(...*)} logger` -- Logger to use.
   * * `{?RateLimiterService} rateLimiter` -- Replacemant for `rateLimiter`
   *   (service instance, not just a name).
   * * `{?RequestLoggerService} requestLogger` -- Replacemant for `rateLimiter`
   *   (service instance, not just a name).
   *
   * @param {ServerConfig} config Parsed configuration item.
   * @param {object} extraConfig Additional configuration, per the above
   *   description.
   */
  constructor(config, extraConfig) {
    MustBe.instanceOf(config, ServerConfig);

    const { endpoint, mounts }                 = config;
    const { interface: iface, port, protocol } = endpoint;

    const { applicationMap, hostManager, logger, rateLimiter, requestLogger } = extraConfig;

    super(config, logger);

    this.#hostManager = hostManager;
    this.#mountMap    = ServerController.#makeMountMap(mounts, applicationMap);

    const wranglerOptions = {
      rateLimiter,
      requestHandler: (req, res, next) => this.#handleRequest(req, res, next),
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

  /**
   * Starts the server.
   */
  async start() {
    return this.#wrangler.start();
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    return this.#wrangler.stop();
  }

  /**
   * Handles a request dispatched from Express (or similar). Parameters are as
   * defined by the Express middleware spec.
   *
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @param {function(?*)} next Function which causes the next-bound middleware
   *   to run.
   */
  #handleRequest(req, res, next) {
    const reqLogger = WranglerContext.get(req)?.logger;

    const { path, subdomains } = req;

    // Freezing `subdomains` lets `new TreePathKey()` avoid making a copy.
    const hostKey = new TreePathKey(Object.freeze(subdomains), false);
    const pathKey = ServerController.#parsePath(path);

    // Find the mount map for the most-specific matching host.
    const hostMatch = this.#mountMap.find(hostKey);
    if (!hostMatch) {
      // No matching host.
      reqLogger?.hostNotFound();
      next();
      return;
    }

    const pathMatch = hostMatch.value.find(pathKey);
    if (!pathMatch) {
      // No matching path for host.
      reqLogger?.pathNotFound(hostMatch.value);
      next();
      return;
    }

    const controller = pathMatch.value;

    // Thwack the salient context into `req`, set up a `next` to restore the
    // thwackage, and call through to the application. This setup is similar to
    // what Express does when routing, but we have to do it ourselves here
    // because we aren't using Express routing to find our applications.

    const { baseUrl: origBaseUrl, url: origUrl } = req;
    const baseUrlExtra = (pathMatch.key.length === 0)
      ? ''
      : TreePathKey.uriPathStringFrom(pathMatch.key, false);

    req.baseUrl = `${origBaseUrl}${baseUrlExtra}`;
    req.url     = TreePathKey.uriPathStringFrom(pathMatch.keyRemainder);

    reqLogger?.dispatching({
      application: controller.name,
      host:        TreePathKey.hostnameStringFrom(hostMatch.key),
      path:        TreePathKey.uriPathStringFrom(pathMatch.key),
      url:         req.url
    });

    const innerNext = (...args) => {
      req.baseUrl = origBaseUrl;
      req.url     = origUrl;
      next(...args);
    };

    controller.handleRequest(req, res, innerNext);
  }


  //
  // Static members.
  //

  /**
   * Makes the map from each (possibly wildcarded) hostname that this server
   * handles to the map from each (typically wildcarded) path (that is, a path
   * _prefix_ when wildcarded) to the application which handles it.
   *
   * @param {MountConfig[]} mounts Configured application mounts.
   * @param {Map<string, BaseApplication>} applicationMap Map from application
   *   names to corresponding instances.
   * @returns {TreePathMap<TreePathMap<ApplicationController>>} The constructed
   *   mount map.
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
