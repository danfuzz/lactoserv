// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as express from 'express';

import { Uris } from '@this/app-config';
import { HostManager } from '@this/app-hosts';
import { ProtocolWrangler, ProtocolWranglers, WranglerContext } from '@this/app-protocol';
import { TreePathKey, TreePathMap } from '@this/collections';

import { ApplicationController } from '#x/ApplicationController';


/**
 * "Controller" for a single server. This wraps both a (concrete subclass of a)
 * {@link net.Server} object _and_ an {@link express.Application} which
 * _exclusively_ handles that server.
 */
export class ServerController {
  /** @type {string} Server name. */
  #name;

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
   * Constructs an insance. The `config` parameter is the same as the exposed
   * configuration object, except:
   *
   * * with `host` / `hosts` replaced by `hostManager`.
   * * with the `app` binding inside of `mounts` replaced by {@link
   *   ApplicationController} instances.
   * * with `rateLimiter` and `requestLogger` replaced by the corresponding
   *   service instances (instead of just being names).
   *
   * @param {object} serverConfig Server information configuration item, per the
   *   description above.
   * @param {function(...*)} logger Logger to use.
   */
  constructor(serverConfig, logger) {
    this.#name        = serverConfig.name;
    this.#hostManager = serverConfig.hostManager;
    this.#mountMap    = ServerController.#makeMountMap(serverConfig.mounts);
    this.#logger      = logger[this.#name];

    const wranglerOptions = {
      rateLimiter:    serverConfig.rateLimiter,
      requestHandler: (req, res, next) => this.#handleRequest(req, res, next),
      requestLogger:  serverConfig.requestLogger,
      logger:         this.#logger,
      protocol:       serverConfig.protocol,
      socket: {
        host: serverConfig.interface,
        port: serverConfig.port
      },
      ...(
        this.#hostManager
          ? { hosts: this.#hostManager.secureServerOptions }
          : {})
    };
    this.#wrangler = ProtocolWranglers.make(wranglerOptions);
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#name;
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
    const pathKey = ApplicationController.parsePath(path);

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
    // thwackage, and call through to the app. This setup is similar to what
    // Express does when routing, but we have to do it ourselves here because
    // we aren't using Express routing to find our apps.

    const { baseUrl: origBaseUrl, url: origUrl } = req;

    req.baseUrl = origBaseUrl + '/' + pathMatch.path.join('/');
    req.url = '/' + pathMatch.pathRemainder.join('/');

    reqLogger?.dispatching({
      app:  controller.name,
      host: ServerController.#hostMatchString(hostMatch),
      path: ServerController.#pathMatchString(pathMatch),
      url:  req.url
    });

    const innerNext = (...args) => {
      req.baseUrl = origBaseUrl;
      req.url     = origUrl;
      next(...args);
    };

    controller.app.handleRequest(req, res, innerNext);
  }


  //
  // Static members.
  //

  /**
   * Makes the map from each (possibly wildcarded) hostname that this server
   * handles to the map from each (typically wildcarded) path (that is, a path
   * _prefix_ when wildcarded) to the application which handles it.
   *
   * @param {object[]} mounts Mounts, as objects that bind `{app, at}`.
   * @returns {TreePathMap<TreePathMap<ApplicationController>>} The constructed
   *   mount map.
   */
  static #makeMountMap(mounts) {
    const result = new TreePathMap();

    for (const mount of mounts) {
      const { app, at } = mount;
      const { hostname, path } = Uris.parseMount(at);

      let hostMounts = result.findExact(hostname);
      if (!hostMounts) {
        hostMounts = new TreePathMap();
        result.add(hostname, hostMounts);
      }

      hostMounts.add(path, app);
    }

    return result;
  }

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
