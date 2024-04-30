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

      this.#bucket = RateLimitConfig.parse(rawConfig, {
        allowMqg:  true,
        rateType:  ByteRate,
        tokenType: ByteCount
      });
    }

    /** @returns {object} Configuration for the token bucket to use. */
    get bucket() {
      return this.#bucket;
    }
  };
}