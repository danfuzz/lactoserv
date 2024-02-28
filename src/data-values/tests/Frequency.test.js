// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Frequency, UnitQuantity } from '@this/data-values';


describe('constructor()', () => {
  test.each`
  value
  ${0}
  ${0.1}
  ${9999999999}
  `('accepts $value', ({ value }) => {
    expect(() => new Frequency(value)).not.toThrow();
  });

  test.each`
  value
  ${undefined}
  ${null}
  ${123n}
  ${-0.1}
  ${Number.POSITIVE_INFINITY}
  ${[1, 2, 3]}
  `('throws given $value', ({ value }) => {
    expect(() => new Frequency(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Frequency(123)).toBeFrozen();
  });
});

describe('.hertz', () => {
  test('returns the value from the constructor', () => {
    expect(new Frequency(0).hertz).toBe(0);
    expect(new Frequency(123).hertz).toBe(123);
    expect(new Frequency(456.789).hertz).toBe(456.789);
  });
});

describe('.ZERO', () => {
  test('has the value `0`', () => {
    expect(Frequency.ZERO.hertz).toBe(0);
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
    expect(() => Frequency.parse(arg)).toThrow();
  });

  // Error: Syntax error / unknown unit.
  test.each`
  value
  ${''}
  ${'123'}       // No unit.
  ${'hz'}        // No number.
  ${'/sec'}      // Ditto.
  ${'per sec'}   // Ditto.
  ${'1 x'}       // Unknown unit.
  ${'1 per x'}   // Ditto.
  ${'_1 /sec'}   // Leading underscore not allowed.
  `('returns `null` given $value', ({ value }) => {
    expect(Frequency.parse(value)).toBeNull();
  });

  // Success cases, no options.
  test.each`
  value                     | expected
  ${new Frequency(12345)}   | ${12345}
  ${'0 /nsec'}              | ${0}
  ${'0 /ns'}                | ${0}
  ${'0 /usec'}              | ${0}
  ${'0 /us'}                | ${0}
  ${'0 /msec'}              | ${0}
  ${'0 /ms'}                | ${0}
  ${'0 /sec'}               | ${0}
  ${'0 /s'}                 | ${0}
  ${'0 hertz'}              | ${0}
  ${'0 hz'}                 | ${0}
  ${'0 /min'}               | ${0}
  ${'0 /m'}                 | ${0}
  ${'0 per hr'}             | ${0}
  ${'0 per h'}              | ${0}
  ${'0 per_day'}            | ${0}
  ${'0 per_d'}              | ${0}
  ${'0 /sec'}               | ${0}
  ${'0.000_000_001 /nsec'}  | ${1}
  ${'0.000_000_001 per ns'} | ${1}
  ${'0.000_001 /usec'}      | ${1}
  ${'0.000_001 per us'}     | ${1}
  ${'0.001 /msec'}          | ${1}
  ${'0.001 per ms'}         | ${1}
  ${'1 /sec'}               | ${1}
  ${'1 per s'}              | ${1}
  ${'1 /min'}               | ${1/60}
  ${'1 per m'}              | ${1/60}
  ${'1 /hr'}                | ${1/3600}
  ${'1 per h'}              | ${1/3600}
  ${'1 /day'}               | ${1/86400}
  ${'1 per d'}              | ${1/86400}
  ${'234.567_per_sec'}      | ${234.567}
  ${'234.567 /msec'}        | ${1000 * 234.567}
  ${'234.567 per day '}     | ${234.567 / 86400}
  `('returns $expected given $value', ({ value, expected }) => {
    const result = Frequency.parse(value);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Frequency);
    expect(result.hertz).toBe(expected);
  });

  // Success and failure cases, with options.
  test.each`
  value               | options                     | expected
  ${'0 /s'}           | ${{ minInclusive: 0 }}      | ${0}
  ${'-.001 /usec'}    | ${{ minInclusive: 0 }}      | ${null}
  ${'0 per s'}        | ${{ minExclusive: 0 }}      | ${null}
  ${'0.001 / s'}      | ${{ minExclusive: 0 }}      | ${0.001}
  ${'2.01 /s'}        | ${{ maxInclusive: 2 }}      | ${null}
  ${'2 per sec'}      | ${{ maxInclusive: 2 }}      | ${2}
  ${'2 /s'}           | ${{ maxExclusive: 2 }}      | ${null}
  ${'1.99 /s'}        | ${{ maxExclusive: 2 }}      | ${1.99}
  ${'10 per day'}     | ${{ maxExclusive: 100 }}    | ${(1 / 86400) * 10}
  ${new Frequency(1)} | ${{ allowInstance: false }} | ${null}
  `('returns $expected given ($value, $options)', ({ value, options, expected }) => {
    const result = Frequency.parse(value, options);

    if (expected === null) {
      expect(result).toBeNull();
    } else {
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Frequency);
      expect(result.hertz).toBe(expected);
    }
  });

  test('returns the same instance as the one given', () => {
    const freq = new Frequency(123);
    expect(Frequency.parse(freq)).toBe(freq);
  });

  test('returns `null` given a `UnitQuantity` with an unrecognized unit', () => {
    const uq = new UnitQuantity(123, 'zonks', null);
    expect(Frequency.parse(uq)).toBe(null);
  });

  test('returns an instance of this class given a `UnitQuantity` with a recognized unit', () => {
    const uq     = new UnitQuantity(120, null, 'min');
    const result = Frequency.parse(uq);

    expect(result).toBeInstanceOf(Frequency);
    expect(result.hertz).toBe(2);
  });
});
