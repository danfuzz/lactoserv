// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceItem } from '@this/app-config';
import { IntfRateLimiter } from '@this/app-protocol';
import { BaseService, ServiceController } from '@this/app-services';
import { TokenBucket } from '@this/async';
import { JsonSchema } from '@this/json';

import { RateLimitedStream } from '#p/RateLimitedStream';


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
 * * `{number} flowRate` -- The steady-state flow rate, in tokens per unit of
 *   time.
 * * `{number} maxBurstSize` -- The maximum possible size of a burst, in tokens.
 * * `{number} maxQueueGrantSize` -- Optional maximum possible size of a grant
 *   given to a requester in the wait queue, in tokens. If not specified, it is
 *   the same as the `maxBurstSize`. (It is really only meaningful for `data`
 *   limiting.)
 * * `{number} maxQueueSize` -- Optional maximum possible size of the wait
 *   queue, in tokens. This is the number of tokens that are allowed to be
 *   queued up for a grant, when there is insufficient burst capacity to satisfy
 *   all active clients.
 * * `{string} timeUnit` -- The unit of time by which `flowRate` is defined.
 *   Must be one of: `day` (defined here as 24 hours), `hour`, `minute`,
 *   `second`, or `msec` (millisecond).
 *
 * @implements {IntfRateLimiter}
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
   * @param {ServiceItem} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    //const config = controller.config;
    RateLimiterService.#validateConfig(config);

    const { connections, data, requests } = config;

    this.#connections = RateLimiterService.#makeBucket(connections);
    this.#data        = RateLimiterService.#makeBucket(data);
    this.#requests    = RateLimiterService.#makeBucket(requests);
  }

  /** @override */
  async newConnection(logger) {
    return RateLimiterService.#requestOneToken(this.#connections, logger);
  }

  /** @override */
  async newRequest(logger) {
    return RateLimiterService.#requestOneToken(this.#requests, logger);
  }

  /** @override */
  wrapWriter(stream, logger) {
    if (this.#data === null) {
      return stream;
    }

    return RateLimitedStream.wrapWriter(this.#data, stream, logger);
  }

  /** @override */
  async start() {
    // Nothing to do here.
  }

  /** @override */
  async stop() {
    await Promise.all([
      this.#connections?.denyAllRequests(),
      this.#data?.denyAllRequests(),
      this.#requests?.denyAllRequests()
    ]);
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
   * @param {string} timeUnit The time unit for the given `flowRate`.
   * @returns {number} `flowRate` converted to tokens per second.
   */
  static #flowRatePerSecFrom(flowRate, timeUnit) {
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

    const {
      maxBurstSize,
      maxQueueGrantSize,
      maxQueueSize,
      flowRate: origFlowRate,
      timeUnit
    } = config;

    const flowRate = this.#flowRatePerSecFrom(origFlowRate, timeUnit);

    return new TokenBucket(
      { flowRate, maxBurstSize, maxQueueGrantSize, maxQueueSize });
  }

  /**
   * Common implementation for the single-token-type rate limiters.
   *
   * @param {TokenBucket} bucket Which bucket to use.
   * @param {?function(*)} logger Logger to use for this action.
   * @returns {boolean} Was a token actually granted?
   */
  static async #requestOneToken(bucket, logger) {
    if (!bucket) {
      return true;
    }

    const got = await bucket.requestGrant(1);
    if (got.waitTime > 0) {
      logger?.rateLimiterWaited(got.waitTime);
    }

    if (!got.done) {
      logger?.rateLimiterDenied();
    }

    return got.done;
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
          required: ['maxBurstSize', 'flowRate', 'timeUnit'],
          properties: {
            maxBurstSize: {
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
            },
            maxQueueGrantSize: {
              type:             'number',
              exclusiveMinimum: 0,
              maximum:          1e300
            },
            maxQueueSize: {
              type:    'number',
              minimum: 0,
              maximum: 1e10
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
