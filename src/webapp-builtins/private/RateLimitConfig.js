// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Frequency } from '@this/data-values';
import { MustBe } from '@this/typey';
import { TokenBucket } from '@this/webapp-util';


/**
 * Utility for parsing rate limiter configurations.
 */
export class RateLimitConfig {
  /**
   * Parses a rate limiter configuration.
   *
   * @param {object} config Configuration object.
   * @param {object} options Parsing options.
   * @param {boolean} options.allowMqg Whether to recognize `maxQueueGrant`
   *   configuration.
   * @param {function(new:*)} options.rateType Unit quantity class which
   *   represents the token flow rate.
   * @param {function(new:*)} options.tokenType Unit quantity class which
   *   represents tokens.
   * @returns {object} Parsed configuration, suitable for passing to the {@link
   *   TokenBucket} constructor.
   */
  static parse(config, options) {
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
      // `TokenBucket` always wants a plain `Frequency` for its `flowRate`.
      return new Frequency(result.value);
    };

    const parseTokenCount = (value, allowNull) => {
      if ((value === null) && !allowNull) {
        throw new Error('Must be a token count.');
      }

      const result = tokenType.parse(value, {
        range: { minInclusive: 1, maxInclusive: 1e100 }
      });

      if (result === null) {
        throw new Error(`Could not parse token count: ${value}`);
      }

      // `TokenBucket` always wants a plain `number` for its token counts.
      return result.value;
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
}
