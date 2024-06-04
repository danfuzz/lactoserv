// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Frequency, UnitQuantity } from '@this/data-values';
import { TemplateUtil } from '@this/metacomp';
import { MustBe } from '@this/typey';


/**
 * Template class for parsing rate limiter configurations. It is parametric on
 * the token type.
 *
 * @param {string} className The name of the resulting class.
 * @param {function(new:*)} superclass The superclass to extend (inherit from).
 * @param {object} params Template parameters.
 * @param {boolean} [params.allowMaxQueueGrant] Whether to recognize
 *   `maxQueueGrant` configuration. Default `false`.
 * @param {function(new:UnitQuantity)} params.countType Unit quantity class for
 *   counts.
 * @param {function(new:UnitQuantity)} params.rateType Unit quantity class for
 *   rates.
 * @returns {function(new:*)} The instantiated template class.
 */
export const TemplRateLimitConfig = (className, superclass, { allowMaxQueueGrant = false, countType, rateType }) => {
  MustBe.constructorFunction(superclass);
  MustBe.boolean(allowMaxQueueGrant);
  MustBe.constructorFunction(countType);
  MustBe.constructorFunction(rateType);

  return TemplateUtil.make(className, class RateLimitConfig extends superclass {
    // @defaultConstructor

    /**
     * Flow rate. If passed as a `string` it is parsed into an instance of the
     * appropriate rate class.
     *
     * @param {string|UnitQuantity} value Proposed configuration value.
     * @returns {UnitQuantity} Accepted configuration value.
     */
    _config_flowRate(value) {
      const result = rateType.parse(value, { range: { minExclusive: 0 } });

      if (result === null) {
        throw new Error(`Could not parse \`flowRate\`: ${value}`);
      }

      // `TokenBucket` always wants a plain `Frequency` for its `flowRate`.
      return new Frequency(result.value);
    }

    /**
     * Maximum count of items in a burst. If passed as a `string` it is parsed
     * into an instance of the appropriate unit-count class.
     *
     * @param {string|UnitQuantity} value Proposed configuration value.
     * @returns {UnitQuantity} Accepted configuration value.
     */
    _config_maxBurst(value) {
      return RateLimitConfig.#parseTokenCount(value, false);
    }

    /**
     * Maximum count of items that can be queued up for processing, or `null` to
     * have no limit. If passed as a `string` it is parsed into an instance of
     * the appropriate unit-count class.
     *
     * @param {?string|UnitQuantity} value Proposed configuration value.
     * @returns {?UnitQuantity} Accepted configuration value.
     */
    _config_maxQueue(value = null) {
      return RateLimitConfig.#parseTokenCount(value, true);
    }

    /**
     * Maximum count of items that will be returned in a single grant, or `null`
     * to use the default limit (of the smaller of `maxBurst` and `maxQueue`).
     * If passed as a `string` it is parsed into an instance of the appropriate
     * unit-count class.
     *
     * @param {?string|UnitQuantity} value Proposed configuration value.
     * @returns {?UnitQuantity} Accepted configuration value.
     */
    _config_maxQueueGrant(value = null) {
      if (!allowMaxQueueGrant) {
        if (value === null) {
          return null;
        }
        throw new Error('`maxQueueGrant` does not make sense for this kind of rate limiter.');
      }

      return RateLimitConfig.#parseTokenCount(value, true);
    }

    /** @override */
    _impl_validate(config) {
      const result = {
        ...config,
        bucket: Object.freeze({
          flowRate:          config.flowRate,
          maxBurstSize:      config.maxBurst,
          maxQueueGrantSize: config.maxQueueGrant,
          maxQueueSize:      config.maxQueue
        })
      };

      delete result.flowRate;
      delete result.maxBurst;
      delete result.maxQueueGrant;
      delete result.maxQueue;

      return super._impl_validate(result);
    }


    //
    // Static members
    //

    /**
     * Parses a token count of some sort.
     *
     * @param {?string|UnitQuantity} value Proposed configuration value.
     * @param {boolean} allowNull Is `null` allowed for `value`?
     * @returns {UnitQuantity} Accepted configuration value.
     */
    static #parseTokenCount(value, allowNull) {
      if (value === null) {
        if (!allowNull) {
          throw new Error('Must be a token count.');
        }
        return null;
      }

      const result = countType.parse(value, {
        range: { minInclusive: 1, maxInclusive: 1e100 }
      });

      if (result === null) {
        throw new Error(`Could not parse token count: ${value}`);
      }

      // `TokenBucket` always wants a plain `number` for its token counts.
      return result.value;
    }
  });
};
