// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Frequency } from '@this/data-values';
import { IntfLogger } from '@this/loggy-intf';
import { IntfRateLimiter } from '@this/net-protocol';
import { MustBe } from '@this/typey';
import { BaseService } from '@this/webapp-core';
import { TokenBucket } from '@this/webapp-util';


/**
 * Service which can apply various rate limits to network traffic.
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfRateLimiter}
 */
export class ConnectionRateLimiter extends BaseService {
  /**
   * Connection rate limiter, if any.
   *
   * @type {?TokenBucket}
   */
  #connections = null;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const { connections } = this.config;

    this.#connections = ConnectionRateLimiter.#makeBucket(connections);
  }

  /** @override */
  async _impl_handleCall_newConnection(logger) {
    return ConnectionRateLimiter.#requestOneToken(this.#connections, logger);
  }

  /** @override */
  _impl_implementedInterfaces() {
    return [IntfRateLimiter];
  }

  /** @override */
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.#connections?.denyAllRequests();
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
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
  static #Config = class Config extends BaseService.Config {
    /**
     * Configuration for connection rate limiting.
     *
     * @type {?object}
     */
    #connections;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { connections } = rawConfig;

      this.#connections = Config.#parseOneBucket(connections);
    }

    /** @returns {?object} Configuration for connection rate limiting. */
    get connections() {
      return this.#connections;
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

      const flowRate = Frequency.parse(origFlowRate, { range: { minExclusive: 0 } });

      if (flowRate === null) {
        throw new Error(`Could not parse \`flowRate\`: ${origFlowRate}`);
      }

      return Object.freeze({
        flowRate, maxBurstSize, maxQueueSize, maxQueueGrantSize
      });
    }
  };
}
