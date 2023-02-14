// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { NonData } from '@this/data-values';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new NonData(1)).not.toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new NonData('x')).toBeFrozen();
  });
});

describe('.value', () => {
  test('is the value passed in the constructor', () => {
    const value1 = ['a'];
    const value2 = new Map();

    expect(new NonData(value1).value).toBe(value1);
    expect(new NonData(value2).value).toBe(value2);
  });
});
