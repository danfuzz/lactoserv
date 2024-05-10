// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { DataRateLimiter } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new DataRateLimiter({
      flowRate: '10 MiB/sec',
      maxBurst: '100 KiB'
    })).not.toThrow();
  });
});
