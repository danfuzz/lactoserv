// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfConnectionRateLimiter } from '@this/net-protocol';
import { BaseService } from '@this/webapp-core';
import { ConnectionCount, ConnectionRate, TokenBucket }
  from '@this/webapp-util';

import { TemplRateLimitConfig } from '#p/TemplRateLimitConfig';


/**
 * Service which can apply various rate limits to network traffic.
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfConnectionRateLimiter}
 */
export class ConnectionRateLimiter extends BaseService {
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
  async _impl_handleCall_newConnection(logger) {
    const got = await this.#bucket.requestGrant(1);

    if (got.waitTime.sec > 0) {
      logger?.rateLimiterWaited(got.waitTime);
    }

    if (!got.done) {
      logger?.rateLimiterDenied();
    }

    return got.done;
  }

  /** @override */
  _impl_implementedInterfaces() {
    return [IntfConnectionRateLimiter];
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
    return TemplRateLimitConfig(
      'ConnectionRateLimiterConfig',
      BaseService.CONFIG_CLASS,
      {
        countType: ConnectionCount,
        rateType:  ConnectionRate
      });
  }
}
