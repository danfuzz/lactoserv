// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseCodec } from '@this/codec';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new BaseCodec()).not.toThrow();
  });
});

describe('decode()', () => {
  test('throws', () => {
    const conv = new BaseCodec();
    expect(() => conv.decode(null)).toThrow(/Abstract/);
  });
});

describe('encode()', () => {
  test('throws', () => {
    const conv = new BaseCodec();
    expect(() => conv.encode(null)).toThrow(/Abstract/);
  });
});


//
// Static members
//

describe('.ENCODE', () => {
  test('is a symbol', () => {
    expect(BaseCodec.ENCODE).toBeSymbol();
  });

  test('is uninterned', () => {
    const interned = Symbol.for(BaseCodec.ENCODE.description);
    expect(BaseCodec.ENCODE).not.toBe(interned);
  });
});

describe('.OMIT', () => {
  test('is a symbol', () => {
    expect(BaseCodec.OMIT).toBeSymbol();
  });

  test('is uninterned', () => {
    const interned = Symbol.for(BaseCodec.OMIT.description);
    expect(BaseCodec.OMIT).not.toBe(interned);
  });
});

describe('.UNHANDLED', () => {
  test('is a symbol', () => {
    expect(BaseCodec.UNHANDLED).toBeSymbol();
  });

  test('is uninterned', () => {
    const interned = Symbol.for(BaseCodec.UNHANDLED.description);
    expect(BaseCodec.UNHANDLED).not.toBe(interned);
  });
});

describe('decodingUnimplemented()', () => {
  test('throws', () => {
    expect(() => BaseCodec.decodingUnimplemented(null)).toThrow();
  });
});
