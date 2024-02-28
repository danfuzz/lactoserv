// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { UnitQuantity } from '@this/data-values';


describe('constructor()', () => {
  test.each`
  args
  ${[0, null, null]}
  ${[0.1, null, null]}
  ${[-10, null, null]}
  ${[9999999999, null, null]}
  ${[0, 'x', null]}
  ${[0, null, 'x']}
  ${[0, 'x', 'x']}
  `('accepts $args', ({ args }) => {
    expect(() => new UnitQuantity(...args)).not.toThrow();
  });

  test.each`
  args
  ${[undefined, null, null]}
  ${[null, null, null]}
  ${[true, null, null]}
  ${[123n, null, null]}
  ${[Number.POSITIVE_INFINITY, null, null]}
  ${[[123], null, null]}
  ${[0, undefined, null]}
  ${[0, false, null]}
  ${[0, 123, null]}
  ${[0, null, undefined]}
  ${[0, null, false]}
  ${[0, null, 123]}
  ${[0]}
  ${[0, 'x']}
  `('throws given $args', ({ args }) => {
    expect(() => new UnitQuantity(...args)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new UnitQuantity(123, 'abc', 'xyz')).toBeFrozen();
  });
});

describe('.denominatorUnit', () => {
  test('returns the denominator unit from the constructor', () => {
    expect(new UnitQuantity(0, 'x', 'y').denominatorUnit).toBe('y');
    expect(new UnitQuantity(0, 'x', null).denominatorUnit).toBeNull();
  });
});

describe('.numeratorUnit', () => {
  test('returns the numerator unit from the constructor', () => {
    expect(new UnitQuantity(0, 'x', 'y').numeratorUnit).toBe('x');
    expect(new UnitQuantity(0, null, 'y').numeratorUnit).toBeNull();
  });
});

describe('.unitString', () => {
  test.each`
  numer    | denom      | expected
  ${null}  | ${null}    | ${'/'}
  ${'x'}   | ${null}    | ${'x/'}
  ${null}  | ${'y'}     | ${'/y'}
  ${'x'}   | ${'y'}     | ${'x/y'}
  ${'bop'} | ${'zoopy'} | ${'bop/zoopy'}
  `('returns $expected given ($numer, $denom)', ({ numer, denom, expected }) => {
    expect(new UnitQuantity(0, numer, denom).unitString).toBe(expected);
  });
});

describe('.value', () => {
  test('returns the value from the constructor', () => {
    expect(new UnitQuantity(0, 'x', 'y').value).toBe(0);
    expect(new UnitQuantity(123, 'x', 'y').value).toBe(123);
    expect(new UnitQuantity(456.789, 'x', 'y').value).toBe(456.789);
  });
});

describe.each`
methodName
${'add'}
${'subtract'}
`('$methodName()', ({ methodName }) => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${123}
  ${['x']}
  ${new Map()}
  `('throws given $arg', ({ arg }) => {
    const uq = new UnitQuantity(123, 'a', 'b');
    expect(() => uq[methodName](arg)).toThrow();
  });

  test('throws if the numerator units do not match', () => {
    const uq1 = new UnitQuantity(1, 'a', 'yes');
    const uq2 = new UnitQuantity(1, 'b', 'yes');
    expect(() => uq1[methodName](uq2)).toThrow();
  });

  test('throws if the denominator units do not match', () => {
    const uq1 = new UnitQuantity(1, 'yes', 'x');
    const uq2 = new UnitQuantity(1, 'yes', 'y');
    expect(() => uq1[methodName](uq2)).toThrow();
  });

  test.each`
  v1     | v2    | add    | subtract
  ${100} | ${1}  | ${101} | ${99}
  ${5}   | ${20} | ${25}  | ${-15}
  `('works for $v1 and $v2', ({ v1, v2, ...expected }) => {
    const uq1    = new UnitQuantity(v1, 'x', 'y');
    const uq2    = new UnitQuantity(v2, 'x', 'y');
    const result = uq1[methodName](uq2);

    expect(result).toBeInstanceOf(UnitQuantity);
    expect(result.numeratorUnit).toBe('x');
    expect(result.denominatorUnit).toBe('y');
    expect(result.value).toBe(expected[methodName]);
  });

  test('returns an instance of the same class as `this`', () => {
    class UqSub extends UnitQuantity {
      // This space intentionally left blank.
    }

    const uq1    = new UqSub(123, 'x', 'y');
    const uq2    = new UnitQuantity(456, 'x', 'y');
    const result = uq1[methodName](uq2);

    expect(result).toBeInstanceOf(UqSub);
  });
});

describe('inverse()', () => {
  test('returns an instance of this class', () => {
    const result = new UnitQuantity(123, 'x', 'y').inverse();
    expect(result).toBeInstanceOf(UnitQuantity);
  });

  test('inverts the value', () => {
    const value  = 123999;
    const result = new UnitQuantity(value, 'x', 'y').inverse();

    expect(result.value).toBe(1 / value);
  });

  test('swaps the numerator and denominator', () => {
    const result = new UnitQuantity(12, 'x', 'y').inverse();

    expect(result.numeratorUnit).toBe('y');
    expect(result.denominatorUnit).toBe('x');
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
    expect(() => UnitQuantity.parse(arg)).toThrow();
  });

  // Syntax errors.
  test.each`
  value
  ${''}
  ${'123'}       // No unit.
  ${' 123 '}     // Ditto.
  ${'a'}         // No number.
  ${'1z abc'}    // Invalid character in number.
  ${'$1 xyz'}    // Ditto.
  ${'1  x'}      // Too many spaces after number.
  ${'1 2 q'}     // No spaces in number.
  ${'_1 boop'}   // Leading underscore not allowed.
  ${'1_ bonk'}   // Trailing underscore not allowed (with space after).
  ${'1__2 hz'}   // Double underscores not allowed in number.
  ${'3__kB'}     // Double underscores not allowed after number.
  ${'1._2 MM'}   // Underscore not allowed next to dot.
  ${'1_.2 zyx'}  // Ditto.
  ${'1e2e3 x'}   // At most one exponent.
  ${'1e1.2 bb'}  // No fractional exponent.

  // Invalid characters in unit.
  ${'1 b7b'}
  ${'1 b@b'}
  ${'1 b$b'}
  ${'1 b/7'}
  ${'1 b per 7'}
  ${'1 per %'}
  ${'1 per x*'}

  // Denominator problems, with slashes.
  ${'1 /'}       // No "naked" slash.
  ${'1/'}        // Ditto.
  ${'1 b/c/d'}   // Only one slash in unit.
  ${'1 b/c/'}    // Ditto.
  ${'1 /c/'}     // Ditto.
  ${'1 b/'}      // No slash at end.
  ${'1 b/ '}     // Ditto.
  ${'1 b/_'}     // Ditto.
  ${'1 b  /c'}   // No more than one space on either side of slash.
  ${'1 b/  c'}   // Ditto.
  ${'1 b__/c'}   // No more than one underscore on either side of slash.
  ${'1 b/__c'}   // Ditto.
  ${'1 b_ /c'}   // No more space-underscore combo on either side of slash.
  ${'1 b _/c'}   // Ditto.
  ${'1 b/_ c'}   // Ditto.
  ${'1 b/ _c'}   // Ditto.

  // Like the slash tests above, but with "per".
  ${'1 per'}
  ${'1per'}
  ${'1per '}
  ${'1per_'}
  ${'1_per'}
  ${'1 b per c per d'}
  ${'1 b per c per'}
  ${'1 per c per'}
  ${'1 b per'}
  ${'1 b per '}
  ${'1 b per_'}
  ${'1 b  per c'}
  ${'1 b per  c'}
  ${'1 b__per c'}
  ${'1 b per__c'}
  ${'1 b_ per c'}
  ${'1 b _per c'}
  ${'1 b per_ c'}
  ${'1 b per _c'}
  ${'1 per per'}
  ${'1 /per'}
  ${'1 per/'}

  // Generally invalid number syntax, as are all the rest...
  ${'. z'}
  ${'..1 z'}
  ${'1.. z'}
  ${'1..2 z'}
  ${'e1 z'}
  ${'E1 z'}
  ${'.e z'}
  ${'.e1 z'}
  ${'1ee1 z'}
  ${'++1 z'}
  ${'--1 z'}
  ${'+-1 z'}
  ${'-+1 z'}
  ${'1+ z'}
  ${'1- z'}
  ${'1+1 z'}
  ${'1-1 z'}
  ${'1e z'}
  ${'1E z'}
  ${'1e+ z'}
  ${'1E- z'}
  ${'1e+ z'}
  ${'1E- z'}
  ${'1e++1 z'}
  ${'1e--1 z'}
  ${'1e1+ z'}
  ${'1e1- z'}
  ${'1e1+1 z'}
  ${'1e1-1 z'}
  ${'_123 z'}
  `('returns `null` given $value', ({ value }) => {
    expect(UnitQuantity.parse(value)).toBeNull();
  });

  test('returns the exact instance when passed an instance, when allowed to', () => {
    const uq = new UnitQuantity(123, 'x', 'y');

    expect(UnitQuantity.parse(uq)).toBe(uq);
    expect(UnitQuantity.parse(uq, { allowInstance: true })).toBe(uq);
  });

  test('returns `null` when passed an instance but not allowed to "parse" it', () => {
    const uq = new UnitQuantity(123, 'x', 'y');

    expect(UnitQuantity.parse(uq, { allowInstance: false })).toBeNull();
  });

  // Success cases, no options.
  test.each`
  value                   | expected
  ${'0 x'}                | ${[0, 'x', null]}
  ${'0 xyz'}              | ${[0, 'xyz', null]}
  ${'0 ABCXYZ'}           | ${[0, 'ABCXYZ', null]}
  ${' 0 x '}              | ${[0, 'x', null]}
  ${'   0 x   '}          | ${[0, 'x', null]}
  ${'0_x'}                | ${[0, 'x', null]}
  ${'0z'}                 | ${[0, 'z', null]}
  ${'0 /x'}               | ${[0, null, 'x']}
  ${'0 / x'}              | ${[0, null, 'x']}
  ${'0/x'}                | ${[0, null, 'x']}
  ${'0_/x'}               | ${[0, null, 'x']}
  ${'0/_x'}               | ${[0, null, 'x']}
  ${'0 x/y'}              | ${[0, 'x', 'y']}
  ${'0per x'}             | ${[0, null, 'x']}
  ${'0 per x'}            | ${[0, null, 'x']}
  ${'0_per x'}            | ${[0, null, 'x']}
  ${'0_per_x'}            | ${[0, null, 'x']}
  ${'0 x per y'}          | ${[0, 'x', 'y']}
  ${'0 x_per_y'}          | ${[0, 'x', 'y']}
  ${'0_x_per_y'}          | ${[0, 'x', 'y']}
  ${'1.2 z'}              | ${[1.2, 'z', null]}
  ${'0.2 z'}              | ${[0.2, 'z', null]}
  ${'.2 z'}               | ${[0.2, 'z', null]}
  ${'1234567890 zonk'}    | ${[1234567890, 'zonk', null]}
  ${'-1 a/b'}             | ${[-1, 'a', 'b']}
  ${'+1 a/b'}             | ${[1, 'a', 'b']}
  ${'2e+0 zz'}            | ${[2, 'zz', null]}
  ${'2e-0 zz'}            | ${[2, 'zz', null]}
  ${'123e5 zonk/zip'}     | ${[123e5, 'zonk', 'zip']}
  ${'123e+5 zonk/zip'}    | ${[123e5, 'zonk', 'zip']}
  ${'123e-5 zonk/zip'}    | ${[123e-5, 'zonk', 'zip']}
  ${'1_2 x'}              | ${[12, 'x', null]}
  ${'1_23_4 x'}           | ${[1234, 'x', null]}
  ${'12_34_5 x'}          | ${[12345, 'x', null]}
  ${'1_2_3_4_5 x'}        | ${[12345, 'x', null]}
  ${'1_2_3_4_5_x'}        | ${[12345, 'x', null]}
  ${'12.3_4_5 florp/z'}   | ${[12.345, 'florp', 'z']}
  `('returns $expected given $value', ({ value, expected }) => {
    const result = UnitQuantity.parse(value);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(UnitQuantity);
    expect(result.value).toBe(expected[0]);
    expect(result.numeratorUnit).toBe(expected[1]);
    expect(result.denominatorUnit).toBe(expected[2]);
  });

  // Success and failure cases, with range options.
  test.each`
  value               | options                | expected
  ${'0 z'}            | ${{ minInclusive: 0 }} | ${0}
  ${'-.001 z'}        | ${{ minInclusive: 0 }} | ${null}
  ${'0 z'}            | ${{ minExclusive: 0 }} | ${null}
  ${'0.001 z'}        | ${{ minExclusive: 0 }} | ${0.001}
  ${'0 z'}            | ${{ maxInclusive: 0 }} | ${0}
  ${'-0.1 z'}         | ${{ maxInclusive: 0 }} | ${-0.1}
  ${'0 z'}            | ${{ maxExclusive: 0 }} | ${null}
  ${'-.001 z'}        | ${{ maxExclusive: 0 }} | ${-0.001}
  ${[0, 'a', 'b']}    | ${{ minInclusive: 0 }} | ${'same'}
  ${[-0.1, 'a', 'b']} | ${{ minInclusive: 0 }} | ${null}
  ${[0, 'a', 'b']}    | ${{ minExclusive: 0 }} | ${null}
  ${[0.1, 'a', 'b']}  | ${{ minExclusive: 0 }} | ${'same'}
  ${[0, 'a', 'b']}    | ${{ maxInclusive: 0 }} | ${'same'}
  ${[-0.1, 'a', 'b']} | ${{ maxInclusive: 0 }} | ${'same'}
  ${[0, 'a', 'b']}    | ${{ maxExclusive: 0 }} | ${null}
  ${[-0.1, 'a', 'b']} | ${{ maxExclusive: 0 }} | ${'same'}
  `('returns $expected given ($value, $options)', ({ value, options, expected }) => {
    if (Array.isArray(value)) {
      value = new UnitQuantity(...value);
    }

    const result = UnitQuantity.parse(value, options);

    if (expected === null) {
      expect(result).toBeNull();
    } else if (expected === 'same') {
      expect(result).toBe(value);
    } else {
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(UnitQuantity);
      expect(result.value).toBe(expected);
    }
  });
});
