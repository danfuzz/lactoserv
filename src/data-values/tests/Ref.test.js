// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Ref } from '@this/data-values';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new Ref(1)).not.toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Ref('x')).toBeFrozen();
  });
});

describe('.value', () => {
  test('is the value passed in the constructor', () => {
    const value1 = ['a'];
    const value2 = new Map();

    expect(new Ref(value1).value).toBe(value1);
    expect(new Ref(value2).value).toBe(value2);
  });
});
