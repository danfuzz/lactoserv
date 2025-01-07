// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ByteRate, UnitQuantity } from '@this/quant';


describe('constructor()', () => {
  test.each`
  value
  ${0}
  ${0.1}
  ${-10}
  ${9999999999}
  `('accepts $value', ({ value }) => {
    expect(() => new ByteRate(value)).not.toThrow();
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
    expect(() => new ByteRate(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new ByteRate(123)).toBeFrozen();
  });
});

describe('[UnitQuantity.INVERSE]', () => {
  test('is `UnitQuantity`', () => {
    const dur = new ByteRate(123);
    expect(dur[UnitQuantity.INVERSE]).toBe(UnitQuantity);
  });
});

describe('.bytePerSec', () => {
  test('returns the value from the constructor', () => {
    expect(new ByteRate(0).bytePerSec).toBe(0);
    expect(new ByteRate(123).bytePerSec).toBe(123);
    expect(new ByteRate(456.789).bytePerSec).toBe(456.789);
  });
});

describe('inverse()', () => {
  test('returns an instance of `UnitQuantity`', () => {
    const result = new ByteRate(123).inverse();
    expect(result).toBeInstanceOf(UnitQuantity);
    expect(result.value).toBe(1/123);
    expect(result.numeratorUnit).toBe('sec');
    expect(result.denominatorUnit).toBe('byte');
  });
});

describe.each`
method                    | isStatic
${'stringFromBytePerSec'} | ${true}
${'toString'}             | ${false}
`('$method()', ({ method, isStatic }) => {
  test.each`
  bps                    | string
  ${0}                   | ${'0 B/sec'}
  ${0.0012347}           | ${'0.00 B/sec'}
  ${0.0049}              | ${'0.00 B/sec'}
  ${0.005}               | ${'0.01 B/sec'}
  ${0.99}                | ${'0.99 B/sec'}
  ${0.998}               | ${'1.00 B/sec'}
  ${1}                   | ${'1 B/sec'}
  ${1023}                | ${'1023 B/sec'}
  ${1024}                | ${'1024 B/sec'}
  ${99999}               | ${'99999 B/sec'}
  ${100000}              | ${'97.66 KiB/sec'}
  ${100008}              | ${'97.66 KiB/sec'}
  ${100009}              | ${'97.67 KiB/sec'}
  ${1024 * 100}          | ${'100 KiB/sec'}
  ${1024 * 100 + 1}      | ${'100.00 KiB/sec'}
  ${1024 * 100 - 1}      | ${'100.00 KiB/sec'}
  ${1024 * 1000}         | ${'1000 KiB/sec'}
  ${1024 * 1000 + 1}     | ${'1000.00 KiB/sec'}
  ${1024 * 1000 - 1}     | ${'1000.00 KiB/sec'}
  ${1024**2}             | ${'1024 KiB/sec'}
  ${1024**2 + 876}       | ${'1024.86 KiB/sec'}
  ${1024**2 * 3}         | ${'3072 KiB/sec'}
  ${1024**2 + 1234567}   | ${'2229.63 KiB/sec'}
  ${1024 * 10000 - 1}    | ${'10000.00 KiB/sec'}
  ${1024 * 10000}        | ${'9.77 MiB/sec'}
  ${1024**2 * 10000 - 1} | ${'10000.00 MiB/sec'}
  ${1024**2 * 10000}     | ${'9.77 GiB/sec'}
  ${1024**3 * 123}       | ${'123 GiB/sec'}
  ${1024**3 * 123 + 999} | ${'123.00 GiB/sec'}
  ${1024**4 * 123}       | ${'123 TiB/sec'}
  ${1024**4 * 123 + 999} | ${'123.00 TiB/sec'}
  ${-1}                  | ${'-1 B/sec'}
  ${-999.123}            | ${'-999.12 B/sec'}
  ${-1234567}            | ${'-1205.63 KiB/sec'}
  ${-(1024 ** 2 * 500)}  | ${'-500 MiB/sec'}
  ${-(1024 ** 3 * 500)}  | ${'-500 GiB/sec'}
  ${-(1024 ** 4 * 500)}  | ${'-500 TiB/sec'}
  `('returns $string given ($bps)', ({ bps, string }) => {
    const result1 = isStatic
      ? ByteRate[method](bps)
      : new ByteRate(bps)[method]();
    const result2 = isStatic
      ? ByteRate[method](bps, { spaces: false })
      : new ByteRate(bps)[method]({ spaces: false });
    const underString = string.replaceAll(/ /g, '_');

    expect(result1).toBe(string);
    expect(result2).toBe(underString);
  });
});

// A couple extra cases for this method (after the above), to check the
// `options` behavior.
describe('stringFromBytePerSec()', () => {
  test.each`
  byte             | options              | string
  ${123}           | ${undefined}         | ${'123 B/sec'}
  ${123}           | ${{ spaces: true }}  | ${'123 B/sec'}
  ${123}           | ${{ spaces: false }} | ${'123_B/sec'}
  `('returns $string given ($byte, $options)', ({ byte, options, string }) => {
    const result = ByteRate.stringFromBytePerSec(byte, options);
    expect(result).toBe(string);
  });
});

describe('.ZERO', () => {
  test('has the value `0`', () => {
    expect(ByteRate.ZERO.bytePerSec).toBe(0);
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
    expect(() => ByteRate.parse(arg)).toThrow();
  });

  // Error: Syntax error / unknown unit. These cases are incomplete because we
  // know the base class it uses to do most of the parsing has pretty full
  // coverage.
  test.each`
  value
  ${''}
  ${'123'}         // No unit.
  ${'kB/sec'}      // No number.
  ${'1 x'}         // Unknown unit.
  ${'1 sec per B'} // Unknown unit (no inverses).
  ${'1 b_yte'}     // Unknown unit.
  ${'1 kb/sec'}    // Unknown unit (case sensitive).
  ${'1z B'}        // Invalid character in number.
  ${'$1 B'}        // Ditto.
  ${'1  B'}        // Too many spaces after number.
  ${'1 2 B'}       // No spaces in number.
    `('returns `null` given $value', ({ value }) => {
    expect(ByteRate.parse(value)).toBeNull();
  });

  // Success cases, no options.
  test.each`
  value                   | expected
  ${new ByteRate(12345)}  | ${12345}
  ${'0 byte/sec'}         | ${0}
  ${'0 B/sec'}            | ${0}
  ${'0 KiB/sec'}          | ${0}
  ${'0 MiB/sec'}          | ${0}
  ${'0 GiB/sec'}          | ${0}
  ${'0 TiB/sec'}          | ${0}
  ${'0 kB/sec'}           | ${0}
  ${'0 MB/sec'}           | ${0}
  ${'0 GB/sec'}           | ${0}
  ${'0 TB/sec'}           | ${0}
  ${'0 byte/s'}           | ${0}
  ${'0 byte/ms'}          | ${0}
  ${'0 byte/msec'}        | ${0}
  ${'0 byte/us'}          | ${0}
  ${'0 byte/usec'}        | ${0}
  ${'0 byte/ns'}          | ${0}
  ${'0 byte/nsec'}        | ${0}
  ${'0 byte/s'}           | ${0}
  ${'0 byte/second'}      | ${0}
  ${'0 byte/m'}           | ${0}
  ${'0 byte/min'}         | ${0}
  ${'0 byte/minute'}      | ${0}
  ${'0 byte/h'}           | ${0}
  ${'0 byte/hr'}          | ${0}
  ${'0 byte/hour'}        | ${0}
  ${'0 byte/d'}           | ${0}
  ${'0 byte/day'}         | ${0}
  ${'1 byte/sec'}         | ${1}
  ${'1 B/sec'}            | ${1}
  ${'1 KiB/sec'}          | ${1024}
  ${'1 MiB/sec'}          | ${1024**2}
  ${'1 GiB/sec'}          | ${1024**3}
  ${'1 TiB/sec'}          | ${1024**4}
  ${'1 kB/sec'}           | ${1000}
  ${'1 MB/sec'}           | ${1000**2}
  ${'1 GB/sec'}           | ${1000**3}
  ${'1 TB/sec'}           | ${1000**4}
  ${'1 byte/s'}           | ${1}
  ${'1 byte/ms'}          | ${1 * 1000}
  ${'1 byte/msec'}        | ${1 * 1000}
  ${'1 byte/us'}          | ${1 * (1000**2)}
  ${'1 byte/usec'}        | ${1 * (1000**2)}
  ${'1 byte/ns'}          | ${1 * (1000**3)}
  ${'1 byte/nsec'}        | ${1 * (1000**3)}
  ${'1 byte/s'}           | ${1}
  ${'1 byte/second'}      | ${1}
  ${'1 byte/m'}           | ${1 / 60}
  ${'1 byte/min'}         | ${1 / 60}
  ${'1 byte/minute'}      | ${1 / 60}
  ${'1 byte/h'}           | ${1 / (60 * 60)}
  ${'1 byte/hr'}          | ${1 / (60 * 60)}
  ${'1 byte/hour'}        | ${1 / (60 * 60)}
  ${'1 byte/d'}           | ${1 / (60 * 60 * 24)}
  ${'1 byte/day'}         | ${1 / (60 * 60 * 24)}
  ${'10_000 B/s'}         | ${10000}
  ${'1234 kB/s'}          | ${1234 * 1000}
  ${'1234 KiB/s'}         | ${1234 * 1024}
  ${'1234 MB/s'}          | ${1234 * 1000**2}
  ${'1234 MiB/s'}         | ${1234 * 1024**2}
  ${'1234 GB/s'}          | ${1234 * 1000**3}
  ${'1234 GiB/s'}         | ${1234 * 1024**3}
  ${'1234 TB/s'}          | ${1234 * 1000**4}
  ${'1234 TiB/s'}         | ${1234 * 1024**4}
  ${'45 byte/s'}          | ${45}
  ${'45 byte/ms'}         | ${45 * 1000}
  ${'45 byte/msec'}       | ${45 * 1000}
  ${'45 byte/us'}         | ${45 * 1000**2}
  ${'45 byte/usec'}       | ${45 * 1000**2}
  ${'45 byte/ns'}         | ${45 * 1000**3}
  ${'45 byte/nsec'}       | ${45 * 1000**3}
  ${'45 byte/m'}          | ${45 / 60}
  ${'45 byte/min'}        | ${45 / 60}
  ${'45 byte/h'}          | ${45 / (60 * 60)}
  ${'45 byte/hr'}         | ${45 / (60 * 60)}
  ${'45 byte/d'}          | ${45 / (60 * 60 * 24)}
  ${'45 byte/day'}        | ${45 / (60 * 60 * 24)}
  ${'5 KiB/us'}           | ${5 * 1024 * 1000**2}
  `('returns $expected given $value', ({ value, expected }) => {
    const result = ByteRate.parse(value);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(ByteRate);
    expect(result.bytePerSec).toBe(expected);
  });

  // Success and failure cases, with options.
  test.each`
  value              | options                               | expected
  ${'0 byte/s'}      | ${{ range: { minInclusive: 0 } }}     | ${0}
  ${'-1 byte/s'}     | ${{ range: { minInclusive: 0 } }}     | ${null}
  ${'0 byte/s'}      | ${{ range: { minExclusive: 0 } }}     | ${null}
  ${'0.001 byte/s'}  | ${{ range: { minExclusive: 0 } }}     | ${0.001}
  ${'0 byte/s'}      | ${{ range: { maxInclusive: 0 } }}     | ${0}
  ${'-0.1 byte/s'}   | ${{ range: { maxInclusive: 0 } }}     | ${-0.1}
  ${'0 byte/s'}      | ${{ range: { maxExclusive: 0 } }}     | ${null}
  ${'-.001 byte/s'}  | ${{ range: { maxExclusive: 0 } }}     | ${-0.001}
  ${'10 KiB/s'}      | ${{ range: { maxExclusive: 10 } }}    | ${null}
  ${'10 KiB/s'}      | ${{ range: { maxExclusive: 10241 } }} | ${10240}
  ${new ByteRate(1)} | ${{ allowInstance: false }}           | ${null}
  `('returns $expected given ($value, $options)', ({ value, options, expected }) => {
    const result = ByteRate.parse(value, options);

    if (expected === null) {
      expect(result).toBeNull();
    } else {
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(ByteRate);
      expect(result.bytePerSec).toBe(expected);
    }
  });

  test('returns the same instance as the one given', () => {
    const result = new ByteRate(123);
    expect(ByteRate.parse(result)).toBe(result);
  });

  test('returns `null` given a `UnitQuantity` with an unrecognized unit', () => {
    const uq = new UnitQuantity(123, 'zonks', null);
    expect(ByteRate.parse(uq)).toBe(null);
  });

  test('returns an instance of this class given a `UnitQuantity` with a recognized unit', () => {
    const uq     = new UnitQuantity(123, 'MiB', 'msec');
    const result = ByteRate.parse(uq);

    expect(result).toBeInstanceOf(ByteRate);
    expect(result.bytePerSec).toBe(123 * 1024**2 * 1000);
  });
});
