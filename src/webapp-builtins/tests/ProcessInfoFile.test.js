// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ProcessInfoFile } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new ProcessInfoFile({
      path:         '/florp',
      updatePeriod: '100 sec'
    })).not.toThrow();
  });

  test('accepts a valid configuration with `save`', () => {
    expect(() => new ProcessInfoFile({
      path: '/florp',
      save: {
        maxOldSize:  '1 MiB',
        maxOldCount: 23,
        onStart:     true,
        onStop:      false
      }
    })).not.toThrow();
  });

  test('accepts a valid configuration with `rotate`', () => {
    expect(() => new ProcessInfoFile({
      path: '/florp',
      rotate: {
        atSize:      '100 KiB',
        checkPeriod: '5 min',
        maxOldSize:  '1 MiB',
        maxOldCount: 99,
        onStart:     false,
        onStop:      true
      }
    })).not.toThrow();
  });

  test('rejects a configuration with both `save` and `rotate`', () => {
    expect(() => new ProcessInfoFile({
      path: '/florp',
      save: {
        maxOldCount: 10,
        onStart:     true
      },
      rotate: {
        atSize: '100 KiB'
      }
    })).toThrow();
  });
});
