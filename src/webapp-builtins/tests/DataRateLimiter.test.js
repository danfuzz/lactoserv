// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { DataRateLimiter } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new DataRateLimiter({
      flowRate: '10 MiB/sec',
      maxBurst: '100 KiB'
    })).not.toThrow();
  });

  test('accepts a valid `maxQueue`', () => {
    expect(() => new DataRateLimiter({
      flowRate: '10 MiB/sec',
      maxBurst: '100 KiB',
      maxQueue: '123 MiB'
    })).not.toThrow();
  });

  test('accepts a valid `maxQueueGrant`', () => {
    expect(() => new DataRateLimiter({
      flowRate:      '10 MiB/sec',
      maxBurst:      '100 KiB',
      maxQueueGrant: '10000 byte'
    })).not.toThrow();
  });
});
