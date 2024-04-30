// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StatusResponse } from '@this/net-util';
import { BaseApplication } from '@this/webapp-core';
import { RequestCount, RequestRate, TokenBucket } from '@this/webapp-util';

import { RateLimitConfig } from '#p/RateLimitConfig';


/**
 * Application that does rate limiting on requests. It operates by delaying
 * until the configured rate is satisfied, then not-handling a request. In the
 * case of a full waiter queue, this _does_ handle the request by reporting
 * status `429` ("Too Many Requests"). Instances of this class are usefully used
 * in the list of apps of a `SerialRouter` (or similar). See docs for
 * configuration object details.
 */
export class RequestRateLimiter extends BaseApplication {
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
  async _impl_handleRequest(request_unused, dispatch_unused) {
    const got = await this.#bucket.requestGrant(1);

    if (got.waitTime.sec > 0) {
      this.logger?.waited(got.waitTime);
    }

    if (!got.done) {
      this.logger?.denied();
      return StatusResponse.fromStatus(429);
    }

    return null;
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
    // @emptyBlock
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
  static #Config = class Config extends BaseApplication.Config {
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
        allowMqg:  false,
        rateType:  RequestRate,
        tokenType: RequestCount
      });
    }

    /** @returns {object} Configuration for the token bucket to use. */
    get bucket() {
      return this.#bucket;
    }
  };
}
