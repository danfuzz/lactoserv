// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ByteCount, ByteRate } from '@this/data-values';
import { IntfDataRateLimiter } from '@this/net-protocol';
import { MustBe } from '@this/typey';
import { BaseService } from '@this/webapp-core';
import { TokenBucket } from '@this/webapp-util';

import { RateLimitedStream } from '#p/RateLimitedStream';


/**
 * Service which can apply data rate-limiting to network traffic.
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfDataRateLimiter}
 */
export class DataRateLimiter extends BaseService {
  /**
   * Underlying token bucket used to perform rate limiting.
   *
   * @type {TokenBucket}
   */
  #bucket;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    this.#bucket = new TokenBucket(this.config);
  }

  /** @override */
  async _impl_handleCall_wrapWriter(stream, logger) {
    return RateLimitedStream.wrapWriter(this.#bucket, stream, logger);
  }

  /** @override */
  _impl_implementedInterfaces() {
    return [IntfDataRateLimiter];
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
    await this.#bucket.denyAllRequests();
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseService.Config {
    /**
     * Configuration for the token bucket to use.
     *
     * @type {object}
     */
    #bucket;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      this.#bucket = Config.#parseRateLimit(this.config, {
        allowMqg:  true,
        rateType:  ByteRate,
        tokenType: ByteCount
      });
    }

    /** @returns {object} Configuration for the token bucket to use. */
    get bucket() {
      return this.#bucket;
    }

    /**
     * Parses the a rate limiter configuration.
     *
     * @param {object} config Configuration object.
     * @param {object} options Parsing options.
     * @param {boolean} options.allowMqg Whether to recognize `maxQueueGrant`
     *   configuration.
     * @param {function(new:*)} options.rateType Unit quantity class which
     *   represents the token flow rate.
     * @param {function(new:*)|string} options.tokenType Unit quantity class
     *   which represents tokens, or the string `number` if plain numbers are
     *   allowed.
     * @returns {object} Parsed configuration, suitable for passing to the
     *   {@link TokenBucket} constructor.
     */
    static #parseRateLimit(config, options) {
      const {
        flowRate,
        maxBurst,
        maxQueueGrant = null,
        maxQueue      = null
      } = config;

      const { allowMqg, rateType, tokenType } = options;

      const parseFlowRate = (value) => {
        const result = rateType.parse(value, { range: { minExclusive: 0 } });
        if (result === null) {
          throw new Error(`Could not parse flow rate: ${value}`);
        }
        return result.value;
      };

      const parseTokenCount = (value, allowNull) => {
        if ((value === null) && !allowNull) {
          throw new Error('Must be a token count.');
        }

        const opts = { range: { minInclusive: 1, maxInclusive: 1e100 } };

        if (tokenType === 'number') {
          return MustBe.number(value, opts);
        } else {
          const result = tokenType.parse(value, opts);
          if (result === null) {
            throw new Error(`Could not parse token count: ${value}`);
          }
          return result.value;
        }
      };

      const result = {
        flowRate:          parseFlowRate(flowRate),
        maxBurstSize:      parseTokenCount(maxBurst, false),
        maxQueueGrantSize: null,
        maxQueueSize:      parseTokenCount(maxQueue, true)
      };

      if (allowMqg) {
        result.maxQueueGrantSize = parseTokenCount(maxQueueGrant, true);
      } else if (maxQueueGrant !== null) {
        throw new Error('Cannot use `maxQueueGrant` with this kind of rate limiter; it is meaningless.');
      }

      return Object.freeze(result);
    }
  };
}
