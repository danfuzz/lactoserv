// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { RequestRateLimiter } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '1 req/sec',
      maxBurst: '10 req'
    })).not.toThrow();
  });
});
