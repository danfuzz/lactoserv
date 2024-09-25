// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration, Moment } from '@this/quant';
import { ProcessInfo } from '@this/host';
import { AskIf } from '@this/typey';


describe('.allInfo', () => {
  test('returns a plain object of the generally-expected shape', () => {
    const got = ProcessInfo.allInfo;
    expect(AskIf.plainObject(got)).toBeTrue();
    expect(got).toContainAllKeys(['memoryUsage', 'pid', 'ppid', 'startedAt', 'uptime']);
  });

  test('returns a different object with each invocation', () => {
    const got1 = ProcessInfo.allInfo;
    const got2 = ProcessInfo.allInfo;
    expect(got1).not.toBe(got2);
  });
});

describe('.ephemeralInfo', () => {
  test('returns a plain object of the generally-expected shape', () => {
    const got = ProcessInfo.ephemeralInfo;
    expect(AskIf.plainObject(got)).toBeTrue();
    expect(got).toContainAllKeys(['memoryUsage', 'uptime']);
  });

  test('returns a different object with each invocation', () => {
    const got1 = ProcessInfo.ephemeralInfo;
    const got2 = ProcessInfo.ephemeralInfo;
    expect(got1).not.toBe(got2);
  });
});

describe('.startedAt', () => {
  test('returns a `Moment`', () => {
    const got = ProcessInfo.startedAt;
    expect(got).toBeInstanceOf(Moment);
  });
});

describe('.uptime', () => {
  test('returns a `Duration`', () => {
    const got = ProcessInfo.uptime;
    expect(got).toBeInstanceOf(Duration);
  });
});

describe('init()', () => {
  test('does not throw', () => {
    expect(() => ProcessInfo.init()).not.toThrow();
  });
});
