// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SpecialCodecs } from '@this/codec';


// TODO: More methods.

describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new SpecialCodecs()).not.toThrow();
  });
});

describe('.STANDARD', () => {
  test('is a frozen instance of this class', () => {
    expect(SpecialCodecs.STANDARD).toBeInstanceOf(SpecialCodecs);
    expect(SpecialCodecs.STANDARD).toBeFrozen();
  });
});

describe('.STANDARD_FOR_LOGGING', () => {
  test('is a frozen instance of this class', () => {
    expect(SpecialCodecs.STANDARD_FOR_LOGGING).toBeInstanceOf(SpecialCodecs);
    expect(SpecialCodecs.STANDARD_FOR_LOGGING).toBeFrozen();
  });
});
