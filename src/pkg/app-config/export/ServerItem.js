// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MountConfig } from '#x/MountConfig';
import { NamedItem } from '#x/NamedItem';
import { Names } from '#x/Names';
import { Uris } from '#x/Uris';
import { Util } from '#x/Util';


/**
 * Configuration representation for a "server" item, that is, the thing that
 * answers network requests and routes them to one or more applications, and
 * which can also be hooked up to one or more auxiliary services.
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * Bindings as defined by the superclass, {@link NamedItem}.
 * * `{string|string[]} hostnames` -- Hostnames which this server should accept
 *   as valid. Can include subdomain or complete wildcards. Defaults to `*`
 *   (that is, responds to all hostnames).
 * * `{string} interface` -- Address of the physical interface that the server
 *   is to listen on. `*` indicates that all interfaces should be listened on.
 *   Note: `::` and `0.0.0.0` are not allowed; use `*` instead.
 * * `{int} port` -- Port number that the server is to listen on.
 * * `{string} protocol` -- Protocol that the server is to speak. Must be one of
 *   `http`, `http2`, or `https`.
 * * `{string} rateLimiter` -- Optional name of the rate limiter service to use.
 *   If not specified, this server will not attempt to do any rate limiting.
 * * `{string} requestLogger` -- Optional name of the request loging service to
 *   inform of activity. If not specified, this server will not produce request
 *   logs.
 * * `{object[]} mounts` -- Array of application mounts, each of a form suitable
 *   for passing to the {@link MountConfig} constructor.
 */
export class ServerItem extends NamedItem {
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /** @type {string} Address of the physical interface to listen on. */
  #interface;

  /** @type {number} Port to listen on. */
  #port;

  /** @type {string} High-level protocol to speak. */
  #protocol;

  /** @type {?string} Name of the rate limiter service to use. */
  #rateLimiter;

  /** @type {?string} Name of the request logger service to use. */
  #requestLogger;

  /** @type {MountConfig[]} Array of application mounts. */
  #mounts;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   */
  constructor(config) {
    super(config);

    const {
      hostnames = '*',
      interface: iface, // `interface` is a reserved word.
      mounts,
      port,
      protocol,
      rateLimiter = null,
      requestLogger = null,
    } = config;

    this.#hostnames     = Util.checkAndFreezeStrings(hostnames, Uris.HOSTNAME_PATTERN);
    this.#interface     = Uris.checkInterface(iface);
    this.#port          = Uris.checkPort(port);
    this.#protocol      = Uris.checkProtocol(protocol);
    this.#rateLimiter   = Names.checkNameOrNull(rateLimiter);
    this.#requestLogger = Names.checkNameOrNull(requestLogger);
    this.#mounts        = MountConfig.parseArray(mounts);
  }

  /**
   * @returns {string[]} List of hostnames, including possibly subdomain and/or
   * full wildcards.
   */
  get hostnames() {
    return this.#hostnames;
  }

  /** @returns {string} Address of the physical interface to listen on. */
  get interface() {
    return this.#interface;
  }

  /** @returns {MountConfig[]} Array of application mounts. */
  get mounts() {
    return this.#mounts;
  }

  /** @returns {number} Port to listen on. */
  get port() {
    return this.#port;
  }

  /** @returns {string} High-level protocol to speak. */
  get protocol() {
    return this.#protocol;
  }

  /** @returns {?string} Name of the rate limiter service to use. */
  get rateLimiter() {
    return this.#rateLimiter;
  }

  /** @returns {?string} Name of the request logger service to use. */
  get requestLogger() {
    return this.#requestLogger;
  }
}
