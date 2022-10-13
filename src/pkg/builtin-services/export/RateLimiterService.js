// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseService, ServiceController } from '@this/app-services';
import { TokenBucket } from '@this/async';
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
  /** @type {?TokenBucket} Connection rate limiter, if any. */
  #connections = null;

  /** @type {?TokenBucket} Outgoing data rate limiter, if any. */
  #data = null;

  /** @type {?TokenBucket} Request rate limiter, if any. */
  #requests = null;

  /**
   * Constructs an instance.
   *
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(controller) {
    super(controller);

    const config = controller.config;
    RateLimiterService.#validateConfig(config);

    const { connections, data, requests } = config;

    this.#connections = RateLimiterService.#makeBucket(connections);
    this.#data        = RateLimiterService.#makeBucket(data);
    this.#requests    = RateLimiterService.#makeBucket(requests);
  }

  /**
   * Waits if necessary, and async-returns when either the caller has been
   * granted a new connection or there is too much load to grant a connection.
   *
   * @param {?function(*)} logger Logger to use for this action.
   * @returns {boolean} Was a connection actually granted?
   */
  async newConnection(logger) {
    if (!this.#connections) {
      return true;
    }

    // TODO: Move the wait/retry logic into `TokenBucket` itself, and make it
    // less clunky.
    let totalWaitTime = 0;
    let waitTime      = 0;
    for (let i = 0; i < 10; i++) {
      if (waitTime) {
        logger?.rateLimited({ attempt: i + 1, waitTime });
        await this.#connections.wait(waitTime);
        totalWaitTime += waitTime;
      }

      const got = this.#connections.takeNow(1);
      if (got.grant === 1) {
        if (i !== 0) {
          logger?.rateLimited({ totalAttempts: i + 1, totalWaitTime })
        }
        return true;
      }

      waitTime = got.waitTime;
    }

    return false;
  }

  // TODO: More!

  /** @override */
  async start() {
    // Nothing to do here.
  }

  /** @override */
  async stop() {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @returns {string} Service type as used in configuration objects. */
  static get TYPE() {
    return 'rate-limiter';
  }

  /**
   * Converts a specified-unit flow rate to one that is per-second.
   *
   * @param {number} flowRate The flow rate.
   * @param {string} timeUnit The time unit for the given `fillRate`.
   * @return {number} `flowRate` converted to tokens per second.
   */
  static #fillRatePerSecFrom(flowRate, timeUnit) {
    switch (timeUnit) {
      case 'day':    return flowRate * (1 / (60 * 60 * 24));
      case 'hour':   return flowRate * (1 / (60 * 60));
      case 'minute': return flowRate * (1 / 60);
      case 'second': return flowRate;               // No conversion needed.
      case 'msec':   return flowRate * 1000;
      default: {
        throw new Error(`Unknown time unit: ${timeUnit}`);
      }
    }
  }

  /**
   * Makes a bucket instance based on the given configuration, or returns `null`
   * if given `null`.
   *
   * @param {?object} config Bucket config, or `null` for "no bucket."
   * @returns {?TokenBucket} Appropriately-constructed bucket, or `null` if
   *   `config === null`.
   */
  static #makeBucket(config) {
    if (!config) {
      return null;
    }

    const { burstSize, flowRate: origFlowRate, timeUnit } = config;
    const capacity = burstSize;
    const fillRate = this.#fillRatePerSecFrom(origFlowRate, timeUnit);

    return new TokenBucket({ capacity, fillRate });
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
