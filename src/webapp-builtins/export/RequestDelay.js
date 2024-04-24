// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfTimeSource, StdTimeSource } from '@this/clocky';
import { Duration } from '@this/data-values';
import { MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that just imposes a delay and then doesn't-handle requests.
 * Instances of this class are usefully used in the list of apps of a
 * `SerialRouter` (or similar). See docs for configuration object details.
 */
export class RequestDelay extends BaseApplication {
  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request_unused, dispatch_unused) {
    const { timeSource } = this.config;
    const delay          = this.#pickDelay();

    await timeSource.waitFor(delay);

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

  /**
   * Picks a delay for a request.
   *
   * @returns {Duration} The delay.
   */
  #pickDelay() {
    const { maxDelay, minDelay } = this.config;

    if (maxDelay === minDelay) {
      return maxDelay;
    } else {
      const minVal     = minDelay.sec;
      const range      = maxDelay.sec - minVal;
      const resultMsec = Math.round(((Math.random() * range) + minVal) * 1000);

      return new Duration(resultMsec / 1000);
    }
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
     * Maximum delay time, inclusive.
     *
     * @type {Duration}
     */
    #maxDelay;

    /**
     * Minimum delay time, inclusive.
     *
     * @type {Duration}
     */
    #minDelay;

    /**
     * Time source.
     *
     * @type {IntfTimeSource}
     */
    #timeSource;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        delay      = null,
        minDelay   = null,
        maxDelay   = null,
        timeSource = null
      } = rawConfig;

      if (delay !== null) {
        if ((maxDelay !== null) || (minDelay !== null)) {
          throw new Error('Must specify either `delay` or both `minDelay` and `maxDelay`.');
        }
        this.#maxDelay = Config.#parseDelay(delay);
        this.#minDelay = this.#maxDelay;
      } else if ((maxDelay !== null) && (minDelay !== null)) {
        this.#maxDelay = Config.#parseDelay(maxDelay);
        this.#minDelay = Config.#parseDelay(minDelay);
        if (this.#minDelay.gt(this.#maxDelay)) {
          throw new Error('`minDelay` must not be greater than `maxDelay`.');
        } else if (this.#minDelay.eq(this.#maxDelay)) {
          // Allow a literal `===` comparison in the handler.
          this.#minDelay = this.#maxDelay;
        }
      } else {
        throw new Error('Must specify either `delay` or both `minDelay` and `maxDelay`.');
      }

      if (timeSource === null) {
        this.#timeSource = StdTimeSource.INSTANCE;
      } else {
        // TODO: Check that it actually implements `IntfTimeSource`.
        this.#timeSource = MustBe.object(timeSource);
      }
    }

    /**
     * @returns {Duration} Maximum delay time, inclusive.
     */
    get maxDelay() {
      return this.#maxDelay;
    }

    /**
     * @returns {Duration} Minimum delay time, inclusive.
     */
    get minDelay() {
      return this.#minDelay;
    }

    /**
     * @returns {IntfTimeSource} Time source.
     */
    get timeSource() {
      return this.#timeSource;
    }


    //
    // Static members
    //

    /**
     * Parses and checks a delay value for validity.
     *
     * @param {string|Duration} value The delay value.
     * @returns {Duration} The parsed value.
     */
    static #parseDelay(value) {
      return Duration.parse(value, { minInclusive: 0 });
    }
  };
}
