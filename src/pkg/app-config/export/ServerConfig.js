// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { EndpointConfig } from '#x/EndpointConfig';
import { MountConfig } from '#x/MountConfig';
import { NamedConfig } from '#x/NamedConfig';
import { Names } from '#x/Names';


/**
 * Configuration representation for a "server" item, that is, the thing that
 * answers network requests and routes them to one or more applications, and
 * which can also be hooked up to one or more auxiliary services.
 *
 * Accepted configuration bindings (in the constructor). All are required,
 * except as noted:
 *
 * * Bindings as defined by the superclass, {@link NamedConfig}.
 * * `{object} endpoint` -- Endpoint configuration, suitable for passing to the
 *   {@link EndpointConfig} constructor.
 * * `{string} rateLimiter` -- Optional name of the rate limiter service to use.
 *   If not specified, this server will not attempt to do any rate limiting.
 * * `{string} requestLogger` -- Optional name of the request loging service to
 *   inform of activity. If not specified, this server will not produce request
 *   logs.
 * * `{object[]} mounts` -- Array of application mounts, each of a form suitable
 *   for passing to the {@link MountConfig} constructor.
 */
export class ServerConfig extends NamedConfig {
  /** @type {EndpointConfig} Endpoint configuration. */
  #endpoint;

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
      endpoint,
      mounts,
      rateLimiter = null,
      requestLogger = null,
    } = config;

    this.#endpoint      = new EndpointConfig(endpoint);
    this.#rateLimiter   = Names.checkNameOrNull(rateLimiter);
    this.#requestLogger = Names.checkNameOrNull(requestLogger);
    this.#mounts        = MountConfig.parseArray(mounts);
  }

  /** @returns {EndpointConfig} Endpoint configuration. */
  get endpoint() {
    return this.#endpoint;
  }

  /** @returns {MountConfig[]} Array of application mounts. */
  get mounts() {
    return this.#mounts;
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
