// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig, Names } from '@this/compote';

import { EndpointConfig } from '#x/EndpointConfig';


/**
 * Class for indicating a mapping from service roles (by name) to corresponding
 * services (also by name) that are to be used for those roles. (See {@link
 * EndpointConfig}.)
 *
 * Accepted configuration (in the constructor) is an object with role names for
 * keys and service names for values. Only specific recognized role names are
 * accepted as valid.
 *
 * Allowed roles:
 *
 * * `rateLimiter` -- Rate limiter service.
 * * `requestLogger` -- Request logging service.
 */
export class ServiceUseConfig extends BaseConfig {
  /**
   * The role-to-service mapping.
   *
   * @type {Map<string, string>}
   */
  #map;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Configuration object. See class header for
   *   details.
   */
  constructor(rawConfig) {
    super(rawConfig);

    this.#map = Object.freeze(new Map(Object.entries(rawConfig)));

    for (const [role, name] of this.#map) {
      Names.checkName(role);
      Names.checkName(name);
      if (!ServiceUseConfig.#ROLES.has(role)) {
        throw new Error(`Invalid role: ${role}`);
      }
    }
  }

  /** @returns {Map<string, string>} The map of roles to service names. */
  get map() {
    return this.#map;
  }

  /** @returns {?string} Service name for `rateLimiter` role, if any. */
  get rateLimiter() {
    return this.#map.get('rateLimiter') ?? null;
  }

  /** @returns {?string} Service name for `requestLogger` role, if any. */
  get requestLogger() {
    return this.#map.get('requestLogger') ?? null;
  }


  //
  // Static members
  //

  /**
   * Set of allowed role names.
   *
   * @type {Set<string>}
   */
  static #ROLES = Object.freeze(new Set([
    'rateLimiter',
    'requestLogger'
  ]));
}
