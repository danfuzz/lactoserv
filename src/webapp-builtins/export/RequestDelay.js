// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfTimeSource, StdTimeSource } from '@this/clocky';
import { Duration } from '@this/quant';
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
    return class Config extends super.prototype.constructor.configClass {
      // @defaultConstructor

      /**
       * Delay time, or `null` if `minDelay` and `maxDelay` are being used. If
       * passed as a string, it is parsed by {@link Duration#parse}.
       *
       * @param {?string|Duration} value Proposed configuration value. Default
       *   `null`.
       * @returns {?Duration} Accepted configuration value.
       */
      _config_delay(value = null) {
        return (value === null) ? null : Config.#parseDelay(value);
      }

      /**
       * Maximum delay time, inclusive, if delays are to be made randomly within
       * a range, or `null` if `delay` is being used. If passed as a string, it
       * is parsed by {@link Duration#parse}.
       *
       * @param {?string|Duration} value Proposed configuration value. Default
       *   `null`.
       * @returns {?Duration} Accepted configuration value.
       */
      _config_maxDelay(value = null) {
        return (value === null) ? null : Config.#parseDelay(value);
      }

      /**
       * Minimum delay time, inclusive, if delays are to be made randomly within
       * a range, or `null` if `delay` is being used. If passed as a string, it
       * is parsed by {@link Duration#parse}.
       *
       * @param {?string|Duration} value Proposed configuration value. Default
       *   `null`.
       * @returns {?Duration} Accepted configuration value.
       */
      _config_minDelay(value = null) {
        return (value === null) ? null : Config.#parseDelay(value);
      }

      /**
       * Time source, or `null` to use the standard time source. This
       * configuration option is mostly intended for testing.
       *
       * @param {?IntfTimeSource} [value] Proposed configuration value. Default
       *   `null`.
       * @returns {IntfTimeSource} Accepted configuration value.
       */
      _config_timeSource(value = null) {
        // TODO: Check that a non-`null` `value` actually implements
        // `IntfTimeSource`.

        return (value === null)
          ? StdTimeSource.INSTANCE
          : MustBe.object(value);
      }

      /** @override */
      _impl_validate(config) {
        const { delay } = config;
        let   { maxDelay, minDelay } = config;

        if (!!delay === !!(maxDelay || minDelay)) {
          throw new Error('Must specify either `delay` or both `minDelay` and `maxDelay`.');
        } else if (delay) {
          maxDelay = minDelay = delay;
        } else if (!(maxDelay && minDelay)) {
          throw new Error('Must specify both `minDelay` and `maxDelay` if either is used.');
        } else if (minDelay.gt(maxDelay)) {
          throw new Error('`minDelay` must not be greater than `maxDelay`.');
        } else if (minDelay.eq(maxDelay)) {
          // This allows a `===` comparison in the handler to work.
          minDelay = maxDelay;
        }

        const result = { ...config, maxDelay, minDelay };
        delete result.delay;

        return super._impl_validate(result);
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
        const result = Duration.parse(value, { range: { minInclusive: 0 } });

        if (result === null) {
          throw new Error(`Could not parse delay value: ${value}`);
        }

        return result;
      }
    };
  }
}
