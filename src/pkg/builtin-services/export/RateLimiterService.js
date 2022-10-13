// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseService, ServiceController } from '@this/app-services';
import { JsonSchema } from '@this/json';


/**
 * Service which can apply various rate limits to network traffic. Configuration
 * object details:
 *
 * * `{object} connections` -- Optional connection rate limiter. The "token" for
 *   this is a single connection.
 * * `{object} data` -- Optional outgoing data rate limiter. The "token" for
 *   this is one byte.
 * * `{object} requests` -- Optional request rate limiter. The "token" for this
 *   is a single request.
 *
 * Each of the above, if specified, must be an object with these properties:
 *
 * * `{number} burstSize` -- The maximum possible size of a burst, in tokens.
 * * `{number} flowRate` -- The steady-state flow rate, in tokens per unit of
 *   time.
 * * `{string} timeUnit` -- The unit of time by which `flowRate` is defined.
 *   Must be one of: `day` (defined here as 24 hours), `hour`, `minute`,
 *  `second`, or `msec` (millisecond).
 */
export class RateLimiterService extends BaseService {
  /** @type {?*} Connection rate limiter, if any. */
  #connections = null;

  /** @type {?*} Request rate limiter, if any. */
  #requests = null;

  /** @type {?*} Outgoing data rate limiter, if any. */
  #data = null;

  /**
   * Constructs an instance.
   *
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(controller) {
    super(controller);

    const config = controller.config;
    RateLimiterService.#validateConfig(config);

    // TODO
  }

  // TODO

  /** @override */
  async start() {
    // TODO
  }

  /** @override */
  async stop() {
    // TODO
  }


  //
  // Static members
  //

  /** @returns {string} Service type as used in configuration objects. */
  static get TYPE() {
    return 'rate-limiter';
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema('Rate Limiter Configuration');

    validator.addMainSchema({
      $id: '/RateLimiterService',
      type: 'object',
      properties: {
        connections: { $ref: '#/$defs/limitItem' },
        requests:    { $ref: '#/$defs/limitItem' },
        data:        { $ref: '#/$defs/limitItem' }
      },

      $defs: {
        limitItem: {
          type: 'object',
          required: ['burstSize', 'flowRate', 'timeUnit'],
          properties: {
            burstSize: {
              type:             'number',
              exclusiveMinimum: 0,
              maximum:          1e300
            },
            flowRate: {
              type:             'number',
              exclusiveMinimum: 0,
              maximum:          1e300
            },
            timeUnit: {
              type: 'string',
              enum: ['day', 'hour', 'minute', 'second', 'msec']
            }
          }
        }
      }
    });

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
