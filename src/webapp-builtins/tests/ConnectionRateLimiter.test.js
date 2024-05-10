// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ConnectionRateLimiter } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new ConnectionRateLimiter({
      flowRate: '1 conn/sec',
      maxBurst: '10 conn'
    })).not.toThrow();
  });
});
