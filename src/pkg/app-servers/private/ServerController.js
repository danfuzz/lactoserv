// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as express from 'express';

import { MountItem, ServerItem } from '@this/app-config';
import { HostManager } from '@this/app-hosts';
import { ProtocolWrangler, ProtocolWranglers, WranglerContext } from '@this/app-protocol';
import { TreePathKey, TreePathMap } from '@this/collections';
import { MustBe } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { ApplicationController } from '#x/ApplicationController';


/**
 * "Controller" for a single server. Instances of this class wrap both a
 * (concrete subclass of a) {@link net.Server} object _and_ an {@link
 * express.Application} (or equivalent) which _exclusively_ handles that server.
 */
export class ServerController {
  /** @type {ServerItem} Configuration which defined this instance. */
  #config;

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

  /** @type {function(...*)} Instance-specific logger. */
  #logger;

  /** @type {ProtocolWrangler} Protocol-specific "wrangler." */
  #wrangler;


  /**
   * Constructs an insance. The `extraConfig` argument contains additional
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
   * @param {ServerItem} config Parsed configuration item.
   * @param {object} extraConfig Additional configuration, per the above
   *   description.
   */
  constructor(config, extraConfig) {
    const { interface: iface, mounts, name, port, protocol } = config;

    this.#config = config;

    const { applicationMap, hostManager, logger, rateLimiter, requestLogger } = extraConfig;

    this.#hostManager = hostManager;
    this.#logger      = logger[name];
    this.#mountMap    = ServerController.#makeMountMap(mounts, applicationMap);

    const wranglerOptions = {
      rateLimiter,
      requestHandler: (req, res, next) => this.#handleRequest(req, res, next),
      requestLogger,
      logger: this.#logger,
      protocol,
      socket: { host: iface, port },
      ...(
        this.#hostManager
          ? { hosts: this.#hostManager.secureServerOptions }
          : {})
    };

    this.#wrangler = ProtocolWranglers.make(wranglerOptions);
  }

  /** @returns {ServerItem} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#config.name;
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
   * Handles a request dispatched from Express. Parameters are as defined by the
   * Express middleware spec.
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
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

    req.baseUrl = origBaseUrl + '/' + pathMatch.path.join('/');
    req.url = '/' + pathMatch.pathRemainder.join('/');

    reqLogger?.dispatching({
      application: controller.name,
      host:        ServerController.#hostMatchString(hostMatch),
      path:        ServerController.#pathMatchString(pathMatch),
      url:         req.url
    });

    const innerNext = (...args) => {
      req.baseUrl = origBaseUrl;
      req.url     = origUrl;
      next(...args);
    };

    controller.application.handleRequest(req, res, innerNext);
  }


  //
  // Static members.
  //

  /**
   * Gets a loggable "host match" from a {@link TreePathMap} lookup response.
   *
   * @param {object} match The lookup response.
   * @returns {string} A loggable string.
   */
  static #hostMatchString(match) {
    const { path, wildcard } = match;

    if (wildcard && path.length === 0) {
      return '*';
    }

    const parts = [...path, ...(wildcard ? ['*'] : [])].reverse();
    return parts.join('.');
  }

  /**
   * Makes the map from each (possibly wildcarded) hostname that this server
   * handles to the map from each (typically wildcarded) path (that is, a path
   * _prefix_ when wildcarded) to the application which handles it.
   *
   * @param {MountItem[]} mounts Configured application mounts.
   * @param {Map<string, BaseApplication>} applicationMap Map from application
   *   names to corresponding instances.
   * @returns {TreePathMap<TreePathMap<ApplicationController>>} The constructed
   *   mount map.
   */
  static #makeMountMap(mounts, applicationMap) {
    const result = new TreePathMap();

    for (const mount of mounts) {
      const { application, hostname, path } = mount;

      let hostMounts = result.findExact(hostname);
      if (!hostMounts) {
        hostMounts = new TreePathMap();
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

  /**
   * Gets a loggable "path match" from a {@link TreePathMap} lookup response.
   *
   * @param {object} match The lookup response.
   * @returns {string} A loggable string.
   */
  static #pathMatchString(match) {
    const { path, wildcard } = match;

    if (wildcard) {
      return (path.length === 0)
        ? '/*'
        : `/${path.join('/')}/*`;
    } else {
      return `/${path.join('/')}`;
    }
  }
}
