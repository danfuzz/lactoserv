// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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
