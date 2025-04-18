// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SyslogToFile } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new SyslogToFile({
      format: 'json',
      path:   '/florp'
    })).not.toThrow();
  });
});
