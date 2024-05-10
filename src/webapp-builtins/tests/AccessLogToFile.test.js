// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AccessLogToFile } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new AccessLogToFile({
      path: '/florp'
    })).not.toThrow();
  });
});
