// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ByteCount, UnitQuantity } from '@this/data-values';


describe('constructor()', () => {
  test.each`
  value
  ${0}
  ${0.1}
  ${-10}
  ${9999999999}
  `('accepts $value', ({ value }) => {
    expect(() => new ByteCount(value)).not.toThrow();
  });

  test.each`
  value
  ${undefined}
  ${null}
  ${123n}
  ${Number.POSITIVE_INFINITY}
  ${'27s' /* but maybe we want to do this? */}
  ${[1, 2, 3]}
  `('throws given $value', ({ value }) => {
    expect(() => new ByteCount(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new ByteCount(123)).toBeFrozen();
  });
});

describe('[UnitQuantity.INVERSE]', () => {
  test('is `UnitQuantity`', () => {
    const dur = new ByteCount(123);
    expect(dur[UnitQuantity.INVERSE]).toBe(UnitQuantity);
  });
});

describe('.byte', () => {
  test('returns the value from the constructor', () => {
    expect(new ByteCount(0).byte).toBe(0);
    expect(new ByteCount(123).byte).toBe(123);
    expect(new ByteCount(456.789).byte).toBe(456.789);
  });
});

describe('inverse()', () => {
  test('returns an instance of `UnitQuantity`', () => {
    const result = new ByteCount(123).inverse();
    expect(result).toBeInstanceOf(UnitQuantity);
    expect(result.value).toBe(1/123);
    expect(result.numeratorUnit).toBeNull();
    expect(result.denominatorUnit).toBe('byte');
  });
});

describe.each`
method                   | isStatic
${'stringFromByteCount'} | ${true}
${'toString'}            | ${false}
`('$method()', ({ method, isStatic }) => {
  test.each`
  byte                   | string
  ${0}                   | ${'0 B'}
  ${0.0012347}           | ${'0.00 B'}
  ${0.0049}              | ${'0.00 B'}
  ${0.005}               | ${'0.01 B'}
  ${0.99}                | ${'0.99 B'}
  ${0.998}               | ${'1.00 B'}
  ${1}                   | ${'1 B'}
  ${1023}                | ${'1023 B'}
  ${1024}                | ${'1024 B'}
  ${99999}               | ${'99999 B'}
  ${100000}              | ${'97.66 KiB'}
  ${100008}              | ${'97.66 KiB'}
  ${100009}              | ${'97.67 KiB'}
  ${1024 * 100}          | ${'100 KiB'}
  ${1024 * 100 + 1}      | ${'100.00 KiB'}
  ${1024 * 100 - 1}      | ${'100.00 KiB'}
  ${1024 * 1000}         | ${'1000 KiB'}
  ${1024 * 1000 + 1}     | ${'1000.00 KiB'}
  ${1024 * 1000 - 1}     | ${'1000.00 KiB'}
  ${1024**2}             | ${'1024 KiB'}
  ${1024**2 + 876}       | ${'1024.86 KiB'}
  ${1024**2 * 3}         | ${'3072 KiB'}
  ${1024**2 + 1234567}   | ${'2229.63 KiB'}
  ${1024 * 10000 - 1}    | ${'10000.00 KiB'}
  ${1024 * 10000}        | ${'9.77 MiB'}
  ${1024**2 * 10000 - 1} | ${'10000.00 MiB'}
  ${1024**2 * 10000}     | ${'9.77 GiB'}
  ${1024**3 * 123}       | ${'123 GiB'}
  ${1024**3 * 123 + 999} | ${'123.00 GiB'}
  ${1024**4 * 123}       | ${'123 TiB'}
  ${1024**4 * 123 + 999} | ${'123.00 TiB'}
  ${-1}                  | ${'-1 B'}
  ${-999.123}            | ${'-999.12 B'}
  ${-1234567}            | ${'-1205.63 KiB'}
  ${-(1024 ** 2 * 500)}  | ${'-500 MiB'}
  ${-(1024 ** 3 * 500)}  | ${'-500 GiB'}
  ${-(1024 ** 4 * 500)}  | ${'-500 TiB'}
  `('returns $string given ($byte)', ({ byte, string }) => {
    const result1 = isStatic
      ? ByteCount[method](byte)
      : new ByteCount(byte)[method]();
    const result2 = isStatic
      ? ByteCount[method](byte, { spaces: false })
      : new ByteCount(byte)[method]({ spaces: false });
    const underString = string.replaceAll(/ /g, '_');

    expect(result1).toBe(string);
    expect(result2).toBe(underString);
  });
});

// A couple extra cases for this method (after the above), to check the `null`
// and `options` behavior.
describe('stringFromByteCount()', () => {
  test.each`
  byte             | options              | string
  ${null}          | ${undefined}         | ${'<none>'}
  ${null}          | ${{ spaces: true }}  | ${'<none>'}
  ${null}          | ${{ spaces: false }} | ${'<none>'}
  ${123}           | ${undefined}         | ${'123 B'}
  ${123}           | ${{ spaces: true }}  | ${'123 B'}
  ${123}           | ${{ spaces: false }} | ${'123_B'}
  `('returns $string given ($byte, $options)', ({ byte, options, string }) => {
    const result = ByteCount.stringFromByteCount(byte, options);
    expect(result).toBe(string);
  });
});

describe('.ZERO', () => {
  test('has the value `0`', () => {
    expect(ByteCount.ZERO.byte).toBe(0);
  });
});

describe('parse()', () => {
  // Error: Wrong argument type.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${123}
  ${['123s']}
  ${new Map()}
  `('throws given $arg', ({ arg }) => {
    expect(() => ByteCount.parse(arg)).toThrow();
  });

  // Error: Syntax error / unknown unit. These cases are incomplete because we
  // know the base class it uses to do most of the parsing has pretty full
  // coverage.
  test.each`
  value
  ${''}
  ${'123'}     // No unit.
  ${'byte'}    // No number.
  ${'1 x'}     // Unknown unit.
  ${'1 per B'} // Unknown unit (no inverses).
  ${'1 b_yte'} // Unknown unit.
  ${'1 kb'}    // Unknown unit (case sensitive).
  ${'1z B'}    // Invalid character in number.
  ${'$1 B'}    // Ditto.
  ${'1  B'}    // Too many spaces after number.
  ${'1 2 B'}   // No spaces in number.
    `('returns `null` given $value', ({ value }) => {
    expect(ByteCount.parse(value)).toBeNull();
  });

  // Success cases, no options.
  test.each`
  value                   | expected
  ${new ByteCount(12345)} | ${12345}
  ${'0 byte'}             | ${0}
  ${'0 B'}                | ${0}
  ${'0 KiB'}              | ${0}
  ${'0 MiB'}              | ${0}
  ${'0 GiB'}              | ${0}
  ${'0 TiB'}              | ${0}
  ${'0 kB'}               | ${0}
  ${'0 MB'}               | ${0}
  ${'0 GB'}               | ${0}
  ${'0 TB'}               | ${0}
  ${'10_000 B'}           | ${10000}
  ${'1234 kB'}            | ${1234 * 1000}
  ${'1234 KiB'}           | ${1234 * 1024}
  ${'1234 MB'}            | ${1234 * 1000**2}
  ${'1234 MiB'}           | ${1234 * 1024**2}
  ${'1234 GB'}            | ${1234 * 1000**3}
  ${'1234 GiB'}           | ${1234 * 1024**3}
  ${'1234 TB'}            | ${1234 * 1000**4}
  ${'1234 TiB'}           | ${1234 * 1024**4}
  `('returns $expected given $value', ({ value, expected }) => {
    const result = ByteCount.parse(value);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(ByteCount);
    expect(result.byte).toBe(expected);
  });

  // Success and failure cases, with options.
  test.each`
  value               | options                                | expected
  ${'0 byte'}         | ${{ range: { minInclusive: 0 } }}      | ${0}
  ${'-1 byte'}        | ${{ range: { minInclusive: 0 } }}      | ${null}
  ${'0 byte'}         | ${{ range: { minExclusive: 0 } }}      | ${null}
  ${'0.001 byte'}     | ${{ range: { minExclusive: 0 } }}      | ${0.001}
  ${'0 byte'}         | ${{ range: { maxInclusive: 0 } }}      | ${0}
  ${'-0.1 byte'}      | ${{ range: { maxInclusive: 0 } }}      | ${-0.1}
  ${'0 byte'}         | ${{ range: { maxExclusive: 0 } }}      | ${null}
  ${'-.001 byte'}     | ${{ range: { maxExclusive: 0 } }}      | ${-0.001}
  ${'10 KiB'}         | ${{ range: { maxExclusive: 10 } }}     | ${null}
  ${'10 KiB'}         | ${{ range: { maxExclusive: 10241 } }}  | ${10240}
  ${new ByteCount(1)} | ${{ allowInstance: false }}            | ${null}
  `('returns $expected given ($value, $options)', ({ value, options, expected }) => {
    const result = ByteCount.parse(value, options);

    if (expected === null) {
      expect(result).toBeNull();
    } else {
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(ByteCount);
      expect(result.byte).toBe(expected);
    }
  });

  test('returns the same instance as the one given', () => {
    const result = new ByteCount(123);
    expect(ByteCount.parse(result)).toBe(result);
  });

  test('returns `null` given a `UnitQuantity` with an unrecognized unit', () => {
    const uq = new UnitQuantity(123, 'zonks', null);
    expect(ByteCount.parse(uq)).toBe(null);
  });

  test('returns an instance of this class given a `UnitQuantity` with a recognized unit', () => {
    const uq     = new UnitQuantity(123, 'MiB', null);
    const result = ByteCount.parse(uq);

    expect(result).toBeInstanceOf(ByteCount);
    expect(result.byte).toBe(123 * 1024**2);
  });
});
