// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Names } from '@this/compy';


/**
 * Class for indicating a mapping from service roles (by name) to corresponding
 * services (also by name) that are to be used for those roles.
 *
 * Accepted configuration (in the constructor) is an object with role names for
 * keys and service names for values. Only specific recognized role names are
 * accepted as valid.
 *
 * Allowed roles:
 *
 * * `accessLog` -- Network access logging service.
 * * `connectionRateLimiter` -- Connection rate limiter service.
 * * `dataRateLimiter` -- Data rate limiter service.
 */
export class ServiceUseConfig {
  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Configuration object. See class header for
   *   details.
   */
  constructor(rawConfig) {
    for (const [role, name] of Object.entries(rawConfig)) {
      Names.mustBeName(role);
      Names.mustBeName(name);

      if (!ServiceUseConfig.#ROLES.has(role)) {
        throw new Error(`Invalid role: ${role}`);
      }

      Reflect.defineProperty(this, role, { value: name });
    }
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
    'accessLog',
    'connectionRateLimiter',
    'dataRateLimiter'
  ]));
}
