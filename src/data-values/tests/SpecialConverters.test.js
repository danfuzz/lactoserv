// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SpecialConverters } from '@this/data-values';


// TODO: More methods.

describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new SpecialConverters()).not.toThrow();
  });
});

describe('.STANDARD', () => {
  test('is a frozen instance of this class', () => {
    expect(SpecialConverters.STANDARD).toBeInstanceOf(SpecialConverters);
    expect(SpecialConverters.STANDARD).toBeFrozen();
  });
});

describe('.STANDARD_FOR_LOGGING', () => {
  test('is a frozen instance of this class', () => {
    expect(SpecialConverters.STANDARD_FOR_LOGGING).toBeInstanceOf(SpecialConverters);
    expect(SpecialConverters.STANDARD_FOR_LOGGING).toBeFrozen();
  });
});
