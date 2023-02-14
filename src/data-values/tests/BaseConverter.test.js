// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConverter } from '@this/data-values';


describe('.ENCODE', () => {
  test('is a symbol', () => {
    expect(BaseConverter.ENCODE).toBeSymbol();
  });

  test('is uninterned', () => {
    const interned = Symbol.for(BaseConverter.ENCODE.description);
    expect(BaseConverter.ENCODE).not.toBe(interned);
  });
});

describe('.OMIT', () => {
  test('is a symbol', () => {
    expect(BaseConverter.OMIT).toBeSymbol();
  });

  test('is uninterned', () => {
    const interned = Symbol.for(BaseConverter.OMIT.description);
    expect(BaseConverter.OMIT).not.toBe(interned);
  });
});

describe('.UNHANDLED', () => {
  test('is a symbol', () => {
    expect(BaseConverter.UNHANDLED).toBeSymbol();
  });

  test('is uninterned', () => {
    const interned = Symbol.for(BaseConverter.UNHANDLED.description);
    expect(BaseConverter.UNHANDLED).not.toBe(interned);
  });
});

describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new BaseConverter()).not.toThrow();
  });
});
