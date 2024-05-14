// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ByteCount, ByteRate } from '@this/data-values';
import { IntfDataRateLimiter } from '@this/net-protocol';
import { BaseService } from '@this/webapp-core';
import { TokenBucket } from '@this/webapp-util';

import { RateLimitedStream } from '#p/RateLimitedStream';
import { TemplRateLimitConfig } from '#p/TemplRateLimitConfig';


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
    return RateLimitedStream.wrapWriter(this.#bucket, stream, logger, true);
  }

  /** @override */
  _impl_implementedInterfaces() {
    return [IntfDataRateLimiter];
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#bucket.denyAllRequests();
    await super._impl_stop(willReload);
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return TemplRateLimitConfig(
      'DataRateLimiterConfig',
      BaseService.CONFIG_CLASS,
      {
        allowMaxQueueGrant: true,
        countType:          ByteCount,
        rateType:           ByteRate
      });
  }
}
