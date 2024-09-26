// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseCodec, CodecConfig } from '@this/codec';


describe('constructor()', () => {
  describe('for config `dataClasses`', () => {
    test('accepts a valid frozen array as-is', () => {
      const classes = Object.freeze([Map]);
      const got     = new CodecConfig({ dataClasses: classes });

      expect(got.dataClasses).toBe(classes);
    });

    test('makes a frozen copy of a valid non-frozen array', () => {
      const classes = [Map];
      const got     = new CodecConfig({ dataClasses: classes });

      expect(got.dataClasses).not.toBe(classes);
      expect(got.dataClasses).toBeFrozen();
      expect(got.dataClasses).toEqual(classes);
    });
  });

  describe.each`
  name
  ${'functionAction'}
  ${'instanceAction'}
  ${'proxyAction'}
  `('for config `$name`', ({ name }) => {
    test.each`
    arg
    ${'asObject'}
    ${'error'}
    ${'inspect'}
    ${'name'}
    ${'omit'}
    ${'unhandled'}
    ${'wrap'}
    `('accepts value `$arg`', ({ arg }) => {
      expect(() => new CodecConfig({ [name]: arg })).not.toThrow();
    });

    test('accepts a callable function', () => {
      const func = (val) => `>>${val}<<`;
      expect(() => new CodecConfig({ [name]: func })).not.toThrow();
    });

    test('throws given a proper class (non-callable "function")', () => {
      class SomeClass {
        // @emptyBlock
      }
      expect(() => new CodecConfig({ [name]: SomeClass })).toThrow();
    });

    test.each`
    arg
    ${false}
    ${true}
    ${123}
    ${{ a: 'florp' }}
    ${['wrap']}
    ${'blorp'} // Not one of the allowed string values.
    `('throws given invalid value `$arg`', ({ arg }) => {
      expect(() => new CodecConfig({ [name]: arg })).toThrow();
    });
  });

  describe('for config `specialCases`', () => {
    test('accepts `null` (which is _not_ the same as the default)', () => {
      const got = new CodecConfig({ specialCases: null });

      expect(got.specialCases).toBeNull();
    });

    test('accepts a `BaseCodec` instance', () => {
      const conv = new BaseCodec();
      const got  = new CodecConfig({ specialCases: conv });

      expect(got.specialCases).toBe(conv);
    });
  });

  describe('for config `symbolKeyAction`', () => {
    test.each`
    arg
    ${'error'}
    ${'omit'}
    `('accepts value `$arg`', ({ arg }) => {
      expect(() => new CodecConfig({ symbolKeyAction: arg })).not.toThrow();
    });

    test.each`
    arg
    ${false}
    ${true}
    ${123}
    ${{ a: 'omit' }}
    ${['error']}
    ${'wrap'} // Not one of the allowed string values.
    `('throws given invalid value `$arg`', ({ arg }) => {
      expect(() => new CodecConfig({ symbolKeyAction: arg })).toThrow();
    });
  });
});


//
// Static members
//

describe('makeLoggingInstance()', () => {
  test('produces an instance of this class given no argument', () => {
    const got = CodecConfig.makeLoggingInstance();
    expect(got).toBeInstanceOf(CodecConfig);
  });

  test('produces an instance of this class which reflects the given options', () => {
    const got = CodecConfig.makeLoggingInstance({ freeze: false });
    expect(got).toBeInstanceOf(CodecConfig);
    expect(got.freeze).toBeFalse();
  });
});
