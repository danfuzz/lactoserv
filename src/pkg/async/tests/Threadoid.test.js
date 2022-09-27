// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Threadoid } from '@this/async';

describe('constructor(function)', () => {
  test('trivially succeeds', () => {
    expect(() => new Threadoid(() => null)).not.toThrow();
  });
});

describe('constructor(<invalid>)', () => {
  test.each([
    [null],
    [false],
    [[]],
    [''],
    ['bogus'],
    [['a']],
    [{}],
    [{ a: 10 }],
    [new Map()],
    [class NotACallableFunction {}]
  ])('fails for %p', (value) => {
    expect(() => new EventTracker(value)).toThrow();
  });
});
