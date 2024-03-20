// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TokenBucket } from '@this/async';
import { Frequency } from '@this/data-values';
import { IntfLogger } from '@this/loggy-intf';
import { IntfRateLimiter } from '@this/net-protocol';
import { ServiceConfig } from '@this/sys-config';
import { BaseService } from '@this/sys-framework';
import { MustBe } from '@this/typey';

import { RateLimitedStream } from '#p/RateLimitedStream';


/**
 * Service which can apply various rate limits to network traffic.
 *
 * See `doc/configuration.md` for configuration object details.
 *
 * @implements {IntfRateLimiter}
 */
export class RateLimiter extends BaseService {
  /** @type {?TokenBucket} Connection rate limiter, if any. */
  #connections = null;

  /** @type {?TokenBucket} Outgoing data rate limiter, if any. */
  #data = null;

  /** @type {?TokenBucket} Request rate limiter, if any. */
  #requests = null;

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    const { connections, data, requests } = config;

    this.#connections = RateLimiter.#makeBucket(connections);
    this.#data        = RateLimiter.#makeBucket(data);
    this.#requests    = RateLimiter.#makeBucket(requests);
  }

  /** @override */
  async newConnection(logger) {
    return RateLimiter.#requestOneToken(this.#connections, logger);
  }

  /** @override */
  async newRequest(logger) {
    return RateLimiter.#requestOneToken(this.#requests, logger);
  }

  /** @override */
  wrapWriter(stream, logger) {
    if (this.#data === null) {
      return stream;
    }

    return RateLimitedStream.wrapWriter(this.#data, stream, logger);
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // Nothing needed here for this class.
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Nothing to do here.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await Promise.all([
      this.#connections?.denyAllRequests(),
      this.#data?.denyAllRequests(),
      this.#requests?.denyAllRequests()
    ]);
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
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
    return config
      ? new TokenBucket(config)
      : null;
  }

  /**
   * Common implementation for the single-token-type rate limiters.
   *
   * @param {TokenBucket} bucket Which bucket to use.
   * @param {?IntfLogger} logger Logger to use for this action.
   * @returns {boolean} Was a token actually granted?
   */
  static async #requestOneToken(bucket, logger) {
    if (!bucket) {
      return true;
    }

    const got = await bucket.requestGrant(1);
    if (got.waitTime.sec > 0) {
      logger?.rateLimiterWaited(got.waitTime);
    }

    if (!got.done) {
      logger?.rateLimiterDenied();
    }

    return got.done;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ServiceConfig {
    /** @type {?object} Configuration for connection rate limiting. */
    #connections;

    /** @type {?object} Configuration for data rate limiting. */
    #data;

    /** @type {?object} Configuration for request rate limiting. */
    #requests;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const { connections, data, requests } = config;

      this.#connections = Config.#parseOneBucket(connections);
      this.#data        = Config.#parseOneBucket(data);
      this.#requests    = Config.#parseOneBucket(requests);
    }

    /** @returns {?object} Configuration for connection rate limiting. */
    get connections() {
      return this.#connections;
    }

    /** @returns {?object} Configuration for data rate limiting. */
    get data() {
      return this.#data;
    }

    /** @returns {?object} Configuration for request rate limiting. */
    get requests() {
      return this.#requests;
    }

    /**
     * Parses the bucket configuration for a specific rate-limited entity.
     * Returns `null` if passed `null`.
     *
     * @param {?object} config Optional configuration object.
     * @returns {?object} Parsed configuration or `null`.
     */
    static #parseOneBucket(config) {
      if (!config) {
        return null;
      }

      const {
        flowRate: origFlowRate,
        maxBurstSize,
        maxQueueGrantSize = null,
        maxQueueSize      = null
      } = config;

      MustBe.number(maxBurstSize, { minExclusive: 0, maxInclusive: 1e100 });

      if (maxQueueGrantSize !== null) {
        MustBe.number(maxQueueGrantSize, { minInclusive: 0, maxInclusive: 1e100 });
      }

      if (maxQueueSize !== null) {
        MustBe.number(maxQueueSize, { minInclusive: 0, maxInclusive: 1e100 });
      }

      const flowRate = Frequency.parse(origFlowRate);

      if (flowRate === null) {
        throw new Error(`Could not parse \`flowRate\`: ${origFlowRate}`);
      } else if (flowRate.hertz === 0) {
        throw new Error('`flowRate` must be positive');
      }

      return Object.freeze({
        flowRate, maxBurstSize, maxQueueSize, maxQueueGrantSize
      });
    }
  };
}
