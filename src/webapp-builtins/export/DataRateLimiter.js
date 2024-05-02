// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ByteCount, ByteRate } from '@this/data-values';
import { IntfDataRateLimiter } from '@this/net-protocol';
import { BaseService } from '@this/webapp-core';
import { TokenBucket } from '@this/webapp-util';

import { RateLimitConfig } from '#p/RateLimitConfig';
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

    this.#bucket = new TokenBucket(this.config.bucket);
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
     * Data rate. If passed as a `string` it is parsed into an instance of
     * {@link ByteRate}.
     *
     * @param {string|ByteRate} value Proposed configuration value.
     * @returns {ByteRate} Accepted configuration value.
     */
    _config_flowRate(value) {
      if ((typeof value === 'string') || (value instanceof ByteRate)) {
        return value;
      }

      throw new Error('Invalid value for `flowRate`.');
    }

    /**
     * Maximum data burst size. If passed as a `string` it is parsed into an
     * instance of {@link ByteCount}.
     *
     * @param {string|ByteCount} value Proposed configuration value.
     * @returns {ByteCount} Accepted configuration value.
     */
    _config_maxBurst(value) {
      if ((typeof value === 'string') || (value instanceof ByteCount)) {
        return value;
      }

      throw new Error('Invalid value for `maxBurst`.');
    }

    /**
     * Maximum amount of data that can be queued up for writing, or `null` to
     * have no limit. If passed as a `string` it is parsed into an instance of
     * {@link ByteCount}.
     *
     * @param {?string|ByteCount} value Proposed configuration value.
     * @returns {?ByteCount} Accepted configuration value.
     */
    _config_maxQueue(value = null) {
      if (value === null) {
        return null;
      } else if ((typeof value === 'string') || (value instanceof ByteCount)) {
        return value;
      }

      throw new Error('Invalid value for `maxQueue`.');
    }

    /**
     * Maximum amount of data that will be allowed to be written in a single
     * grant, or `null` to use the default limit (of the smaller of `maxBurst`
     * and `maxQueue`). If passed as a `string` it is parsed into an instance of
     * {@link ByteCount}.
     *
     * @param {?string|ByteCount} value Proposed configuration value.
     * @returns {?ByteCount} Accepted configuration value.
     */
    _config_maxQueueGrant(value = null) {
      if (value === null) {
        return null;
      } else if ((typeof value === 'string') || (value instanceof ByteCount)) {
        return value;
      }

      throw new Error('Invalid value for `maxQueueGrant`.');
    }

    /** @override */
    _impl_validate(config) {
      const bucket = RateLimitConfig.parse(config, {
        rateType:  ByteRate,
        tokenType: ByteCount
      });

      return super._impl_validate({ ...config, bucket });
    }
  };
}
