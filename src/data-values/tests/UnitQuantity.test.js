// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { UnitQuantity } from '@this/data-values';


/**
 * Fake unit class.
 */
class FakeUnit extends UnitQuantity {
  /**
   * Constructs an instance.
   *
   * @param {number} value The value.
   * @param {?string} [numer] Numerator unit.
   * @param {?string} [denom] Denominator unit.
   */
  constructor(value, numer = 'fakeNumer', denom = 'fakeDenom') {
    super(value, numer, denom);
  }
}

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

describe('[UnitQuantity.INVERSE]', () => {
  test('is this class', () => {
    const uq = new UnitQuantity(1, 'x', 'y');
    expect(uq[UnitQuantity.INVERSE]).toBe(UnitQuantity);
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

describe('convertValue()', () => {
  test('returns the original value given a valid no-unit conversion', () => {
    const uq     =  new UnitQuantity(123, null, null);
    const result = uq.convertValue();
    expect(result).toBe(uq.value);
  });

  test('returns `null` on a no-numerator-unit instance when given numerator units', () => {
    const units1 = new Map(Object.entries({ 'x/': 10 }));
    const units2 = new Map(Object.entries({ '/y': 1 }));

    const uq1     = new UnitQuantity(123, null, null);
    const result1 = uq1.convertValue(units1);
    expect(result1).toBeNull();

    const uq2     = new UnitQuantity(1234, null, 'y');
    const result2 = uq2.convertValue(units1, units2);
    expect(result2).toBeNull();
  });

  test('returns `null` on a no-denominator-unit instance when given denominator units', () => {
    const units1 = new Map(Object.entries({ 'x/': 1 }));
    const units2 = new Map(Object.entries({ '/y': 10 }));

    const uq1     = new UnitQuantity(123, null, null);
    const result1 = uq1.convertValue(units2);
    expect(result1).toBeNull();

    const uq2     = new UnitQuantity(1234, 'x', null);
    const result2 = uq2.convertValue(units1, units2);
    expect(result2).toBeNull();
  });

  test('converts a numerator-only instance as expected', () => {
    const units = new Map(Object.entries({
      'orig/': 1,
      'half/': 0.5,
      'ten/':  10
    }));

    const result1 = new UnitQuantity(50, 'orig', null).convertValue(units);
    const result2 = new UnitQuantity(50, 'half', null).convertValue(units);
    const result3 = new UnitQuantity(50, 'ten', null).convertValue(units);

    expect(result1).toBe(50);
    expect(result2).toBe(25);
    expect(result3).toBe(500);
  });

  test('converts a denominator-only instance as expected', () => {
    const units = new Map(Object.entries({
      '/orig': 1,
      '/half': 0.5,
      '/ten':  10
    }));

    const result1 = new UnitQuantity(12, null, 'orig').convertValue(units);
    const result2 = new UnitQuantity(12, null, 'half').convertValue(units);
    const result3 = new UnitQuantity(12, null, 'ten').convertValue(units);

    expect(result1).toBe(12);
    expect(result2).toBe(6);
    expect(result3).toBe(120);
  });

  test('converts a both-units instance as expected', () => {
    const numUnits = new Map(Object.entries({
      'origNum/': 1,
      'half/':    0.5,
      'ten/':     10
    }));
    const denUnits = new Map(Object.entries({
      '/origDen': 1,
      '/tenth':   0.1,
      '/seven':   7
    }));

    const result1 = new UnitQuantity(34, 'origNum', 'origDen').convertValue(numUnits, denUnits);
    const result2 = new UnitQuantity(34, 'half',    'origDen').convertValue(numUnits, denUnits);
    const result3 = new UnitQuantity(70, 'origNum', 'tenth'  ).convertValue(numUnits, denUnits);
    const result4 = new UnitQuantity(5,  'ten',     'seven'  ).convertValue(numUnits, denUnits);
    const result5 = new UnitQuantity(60, 'half',    'tenth'  ).convertValue(numUnits, denUnits);

    expect(result1).toBe(34);
    expect(result2).toBe(17);
    expect(result3).toBe(7);
    expect(result4).toBe(350);
    expect(result5).toBe(3);
  });
});

describe('isInRange()', () => {
  test.each`
  value           | options                  | expected
  ${-0.001}       | ${{ minInclusive: 0 }}   | ${false}
  ${0}            | ${{ minInclusive: 0 }}   | ${true}
  ${0.001}        | ${{ minInclusive: 0 }}   | ${true}
  ${100}          | ${{ minInclusive: 101 }} | ${false}
  ${101}          | ${{ minInclusive: 101 }} | ${true}
  ${1001}         | ${{ minInclusive: 101 }} | ${true}
  ${-0.001}       | ${{ minExclusive: 0 }}   | ${false}
  ${0}            | ${{ minExclusive: 0 }}   | ${false}
  ${0.001}        | ${{ minExclusive: 0 }}   | ${true}
  ${-0.1}         | ${{ maxInclusive: 0 }}   | ${true}
  ${0}            | ${{ maxInclusive: 0 }}   | ${true}
  ${0.1}          | ${{ maxInclusive: 0 }}   | ${false}
  ${10}           | ${{ maxInclusive: 11 }}  | ${true}
  ${-0.001}       | ${{ maxExclusive: 0 }}   | ${true}
  ${0}            | ${{ maxExclusive: 0 }}   | ${false}
  ${0.001}        | ${{ maxExclusive: 0 }}   | ${false}
  ------
  ${10}
  ${{ minInclusive: 20, maxInclusive: 30 }}
  ${false}
  ------
  ${19.99999}
  ${{ minInclusive: 20, maxInclusive: 30 }}
  ${false}
  ------
  ${20}
  ${{ minInclusive: 20, maxInclusive: 30 }}
  ${true}
  ------
  ${30}
  ${{ minInclusive: 20, maxInclusive: 30 }}
  ${true}
  ------
  ${30.000001}
  ${{ minInclusive: 20, maxInclusive: 30 }}
  ${false}
  `('returns $expected given ($value, $options)', ({ value, options, expected }) => {
    const uq     = new UnitQuantity(value, null, null);
    const result = uq.isInRange(options);

    expect(result).toBe(expected);
  });
});

// This is for the bad-argument cases. There are separate `describe()`s for
// success cases.
describe.each`
methodName        | acceptsDifferentUnits
${'add'}          | ${false}
${'compare'}      | ${false}
${'eq'}           | ${false}
${'ge'}           | ${false}
${'gt'}           | ${false}
${'hasSameUnits'} | ${true}
${'le'}           | ${false}
${'lt'}           | ${false}
${'ne'}           | ${false}
${'subtract'}     | ${false}
`('$methodName()', ({ methodName, acceptsDifferentUnits }) => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${true}
  ${123}
  ${123n}
  ${['x']}
  ${new Map()}
  `('throws given $arg', ({ arg }) => {
    const uq = new UnitQuantity(123, 'a', 'b');
    expect(() => uq[methodName](arg)).toThrow();
  });

  if (!acceptsDifferentUnits) {
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
  }
});

describe.each`
methodName
${'add'}
${'subtract'}
`('$methodName()', ({ methodName }) => {
  describe.each`
  v1       | v2       | add     | subtract
  ${0}     | ${0}     | ${0}    | ${0}
  ${12.25} | ${12.25} | ${24.5} | ${0}
  ${100}   | ${1}     | ${101}  | ${99}
  ${1}     | ${100}   | ${101}  | ${-99}
  ${20}    | ${5}     | ${25}   | ${15}
  ${5}     | ${20}    | ${25}   | ${-15}
  `('given ($v1, $v2)', ({ v1, v2, ...expected }) => {
    const exp = expected[methodName];

    test(`returns ${exp}`, () => {
      const uq1    = new UnitQuantity(v1, 'x', 'y');
      const uq2    = new UnitQuantity(v2, 'x', 'y');
      const result = uq1[methodName](uq2);

      expect(result).toBeInstanceOf(UnitQuantity);
      expect(result.numeratorUnit).toBe('x');
      expect(result.denominatorUnit).toBe('y');
      expect(result.value).toBe(expected[methodName]);
    });
  });

  test('returns an instance of the same class as `this`', () => {
    class UqSub extends UnitQuantity {
      // @emptyBlock
    }

    const uq1    = new UqSub(123, 'x', 'y');
    const uq2    = new UnitQuantity(456, 'x', 'y');
    const result = uq1[methodName](uq2);

    expect(result).toBeInstanceOf(UqSub);
  });
});

describe.each`
methodName
${'compare'}
${'eq'}
${'ge'}
${'gt'}
${'le'}
${'lt'}
${'ne'}
`('$methodName()', ({ methodName }) => {
  const F = false;
  const T = true;

  describe.each`
  v1        | v2        | compare | eq   | ne   | lt   | le   | gt   | ge
  ${0}      | ${0}      | ${0}    | ${T} | ${F} | ${F} | ${T} | ${F} | ${T}
  ${123.4}  | ${123.4}  | ${0}    | ${T} | ${F} | ${F} | ${T} | ${F} | ${T}
  ${-12}    | ${-11}    | ${-1}   | ${F} | ${T} | ${T} | ${T} | ${F} | ${F}
  ${7}      | ${123}    | ${-1}   | ${F} | ${T} | ${T} | ${T} | ${F} | ${F}
  ${7.6}    | ${5.4}    | ${1}    | ${F} | ${T} | ${F} | ${F} | ${T} | ${T}
  ${9999.3} | ${9999.2} | ${1}    | ${F} | ${T} | ${F} | ${F} | ${T} | ${T}
  `('given ($v1, $v2)', ({ v1, v2, ...expected }) => {
    const exp = expected[methodName];

    test(`returns ${exp}`, () => {
      const uq1    = new UnitQuantity(v1, 'x', 'y');
      const uq2    = new UnitQuantity(v2, 'x', 'y');
      const result = uq1[methodName](uq2);

      if (typeof exp === 'boolean') {
        expect(result).toBeBoolean();
      } else {
        expect(result).toBeNumber();
      }

      expect(result).toBe(exp);
    });
  });
});

describe('hasSameUnits()', () => {
  class UqSub1 extends UnitQuantity {
    // @emptyBlock
  }

  class UqSub2 extends UnitQuantity {
    // @emptyBlock
  }

  describe.each`
  label                             | thisClass       | otherClass
  ${'both are direct instances'}    | ${UnitQuantity} | ${UnitQuantity}
  ${'`this` is a subclass'}         | ${UqSub1}       | ${UnitQuantity}
  ${'`other` is a subclass'}        | ${UnitQuantity} | ${UqSub1}
  ${'both are the same subclass'}   | ${UqSub1}       | ${UqSub2}
  ${'each is a different subclass'} | ${UqSub1}       | ${UqSub2}
  `('$label', ({ thisClass, otherClass }) => {
    function makeInstances(unit1, unit2) {
      return [
        new thisClass(123, ...unit1),
        new otherClass(456, ...unit2)
      ];
    }

    test('returns `true` for two unitless instances', () => {
      const [uq1, uq2] = makeInstances([null, null], [null, null]);
      expect(uq1.hasSameUnits(uq2)).toBeTrue();
    });

    test('returns `true` for two same-numerator no-denominator instances', () => {
      const [uq1, uq2] = makeInstances(['x', null], ['x', null]);
      expect(uq1.hasSameUnits(uq2)).toBeTrue();
    });

    test('returns `true` for two same-numerator same-denominator instances', () => {
      const [uq1, uq2] = makeInstances(['x', 'y'], ['x', 'y']);
      expect(uq1.hasSameUnits(uq2)).toBeTrue();
    });

    test('returns `true` for two no-numerator same-denominator instances', () => {
      const [uq1, uq2] = makeInstances([null, 'y'], [null, 'y']);
      expect(uq1.hasSameUnits(uq2)).toBeTrue();
    });

    test('returns `false` for two different-numerator no-denominator instances', () => {
      const [uq1, uq2] = makeInstances(['x', null], ['y', null]);
      expect(uq1.hasSameUnits(uq2)).toBeFalse();
    });

    test('returns `false` for two no-numerator different-denominator instances', () => {
      const [uq1, uq2] = makeInstances([null, 'x'], [null, 'y']);
      expect(uq1.hasSameUnits(uq2)).toBeFalse();
    });

    test('returns `false` for two same-numerator different-denominator instances', () => {
      const [uq1, uq2] = makeInstances(['x', 'a'], ['x', 'b']);
      expect(uq1.hasSameUnits(uq2)).toBeFalse();
    });

    test('returns `false` for two different-numerator same-denominator instances', () => {
      const [uq1, uq2] = makeInstances(['a', 'x'], ['b', 'x']);
      expect(uq1.hasSameUnits(uq2)).toBeFalse();
    });

    test('returns `false` for two different-numerator different-denominator instances', () => {
      const [uq1, uq2] = makeInstances(['a', 'x'], ['b', 'y']);
      expect(uq1.hasSameUnits(uq2)).toBeFalse();
    });
  });
});

describe('inverse()', () => {
  test('returns an instance of this class, given a concrete `UnitQuantity`', () => {
    const result = new UnitQuantity(123, 'x', 'y').inverse();
    expect(result).toBeInstanceOf(UnitQuantity);
  });

  test('returns an instance of the preferred inverse class for a subclass that specifies it', () => {
    class UqSub1 extends UnitQuantity {
      // @emptyBlock
    }

    class UqSub2 extends UnitQuantity {
      get [UnitQuantity.INVERSE]() {
        return UqSub1;
      }
    }

    const result = new UqSub2(123, 'x', 'y').inverse();
    expect(result).toBeInstanceOf(UqSub1);
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

describe('toString()', () => {
  describe.each`
  opts                 | spaces
  ${{ spaces: false }} | ${false}
  ${{ spaces: true }}  | ${true}
  ${{}}                | ${true}
  ${null}              | ${true}
  ${undefined}         | ${true}
  `('with `options === $opts`', ({ opts, spaces }) => {
    test.each`
    value                       | expected
    ${[0, null, null]}          | ${'0'}
    ${[0, 'x', null]}           | ${'0 x'}
    ${[0, 'abc', null]}         | ${'0 abc'}
    ${[0, null, 'z']}           | ${'0 /z'}
    ${[0, null, 'def']}         | ${'0 /def'}
    ${[0, 'q', 'r']}            | ${'0 q/r'}
    ${[0, 'bip', 'flop']}       | ${'0 bip/flop'}
    ${[12.34, null, null]}      | ${'12.34'}
    ${[-123, null, null]}       | ${'-123'}
    ${[9.9e99, null, null]}     | ${'9.9e+99'}
    ${[98765, 'xyz', null]}     | ${'98765 xyz'}
    ${[44.12345, null, 'zonk']} | ${'44.12345 /zonk'}
    ${[-909, 'aa', 'bb']}       | ${'-909 aa/bb'}
    `('returns `$expected` given `$value`', ({ value, expected }) => {
      const uq  = new UnitQuantity(...value);
      const got = uq.toString(opts);
      const exp = spaces ? expected : expected.replace(/[ ]/, '_');

      expect(got).toBeString();
      expect(got).toBe(exp);
    });
  });
});


//
// Static members
//

describe('.INVERSE', () => {
  test('is a symbol', () => {
    expect(UnitQuantity.INVERSE).toBeSymbol();
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
  ${'1 b/c/d'}   // Only one slash in unit.
  ${'1 b/c/'}    // Ditto.
  ${'1 /c/'}     // Ditto.
  ${'1 b/_'}     // No trailing underscore (even with slash).
  ${'1 b  /c'}   // No more than one space on either side of slash.
  ${'1 b/  c'}   // Ditto.
  ${'1 b__/c'}   // No more than one underscore on either side of slash.
  ${'1 b/__c'}   // Ditto.
  ${'1 b_ /c'}   // No more space-underscore combo on either side of slash.
  ${'1 b _/c'}   // Ditto.
  ${'1 b/_ c'}   // Ditto.
  ${'1 b/ _c'}   // Ditto.

  // Like the slash tests above, but with "per".
  ${'1per_'}
  ${'1 b per c per d'}
  ${'1 b per c per'}
  ${'1 per c per'}
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

  // Generally invalid number syntax.
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
  `('returns `null` given `$value`', ({ value }) => {
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

  describe('with `{ allowInstance: false }`', () => {
    test('does not accept an instance', () => {
      const uq = new UnitQuantity(123, 'x', null);
      expect(UnitQuantity.parse(uq, { allowInstance: false })).toBeNull();
    });
  });

  describe('with `{ range: ... }`', () => {
    test('accepts a value that falls within the range', () => {
      const opt = {
        range: {
          minInclusive: 1,
          maxInclusive: 10
        }
      };

      const uq1  = UnitQuantity.parse('1 x', opt);
      const uq10 = UnitQuantity.parse('10 x', opt);

      expect(uq1.value).toBe(1);
      expect(uq10.value).toBe(10);
    });

    test('returns `null` given a value that falls outside the range', () => {
      const opt = {
        range: {
          minExclusive: 1,
          maxExclusive: 10
        }
      };

      const uq1  = UnitQuantity.parse('1 x', opt);
      const uq10 = UnitQuantity.parse('10 x', opt);

      expect(uq1).toBeNull();
      expect(uq10).toBeNull();
    });
  });

  describe('with `{ convert: ... }`', () => {
    test('throws when passed both `resultClass` and `resultUnit`', () => {
      expect(() => UnitQuantity.parse('1 x/y', {
        convert: {
          resultUnit:  'x/y',
          resultClass: UnitQuantity
        }
      })).toThrow();
    });

    describe('without `unitMaps` or `result*`', () => {
      test('returns `null` given a syntactically incorrect value', () => {
        expect(UnitQuantity.parse('12 34 56!', { convert: {} })).toBeNull();
      });

      test('returns `null` given a unit-ful value', () => {
        expect(UnitQuantity.parse('12 x', { convert: {} })).toBeNull();
      });

      test('parses a unitless value', () => {
        const uq = UnitQuantity.parse('34', { convert: {} });

        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(34);
        expect(uq.unitString).toBe('/');
      });
    });

    describe('with `resultClass` but not `unitMaps`', () => {
      test('returns `null` given a syntactically incorrect value', () => {
        const uq = UnitQuantity.parse('zonk 126!', {
          convert: {
            resultClass: FakeUnit
          }
        });

        expect(uq).toBeNull();
      });

      test('parses a unit-ful value with arbitrary units', () => {
        const uq = UnitQuantity.parse('12 x per y', {
          convert: {
            resultClass: FakeUnit
          }
        });

        expect(uq).toBeInstanceOf(FakeUnit);
        expect(uq.value).toBe(12);
      });

      test('parses a unitless value', () => {
        const uq = UnitQuantity.parse('4321', {
          convert: {
            resultClass: FakeUnit
          }
        });

        expect(uq).toBeInstanceOf(FakeUnit);
        expect(uq.value).toBe(4321);
      });

      test('throws given a valid value but a non-constuctor for `resultClass`', () => {
        const opts = {
          convert: {
            resultClass: 12345
          }
        };

        expect(() => UnitQuantity.parse('123', opts)).toThrow();
      });
    });

    describe('with `resultUnit` but not `unitMaps`', () => {
      test('returns `null` given a syntactically incorrect value', () => {
        const uq = UnitQuantity.parse('zonk 126!', {
          convert: {
            resultUnit: 'a/b'
          }
        });

        expect(uq).toBeNull();
      });

      test('returns `null` given a unit-ful value with non-matching units', () => {
        const uq = UnitQuantity.parse('12 x per y', {
          convert: {
            resultUnit: 'a/b'
          }
        });

        expect(uq).toBeNull();
      });

      test('throws given a syntactically invalid `resultUnit`', () => {
        const opts = {
          convert: {
            resultUnit: 'hey what is happening today?'
          }
        };

        expect(() => UnitQuantity.parse('123', opts)).toThrow();
      });

      test('parses a value with matching units', () => {
        const uq = UnitQuantity.parse('99 x / y', {
          convert: {
            resultUnit: 'x per y'
          }
        });

        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(99);
        expect(uq.unitString).toBe('x/y');
      });

      test('parses a unitless value when `resultUnit` is unitless', () => {
        const uq = UnitQuantity.parse('1221', {
          convert: {
            resultUnit: '/'
          }
        });

        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(1221);
        expect(uq.unitString).toBe('/');
      });
    });

    describe('with `unitMaps` but not `result*`', () => {
      test('returns `null` given a syntactically incorrect value', () => {
        const uq = UnitQuantity.parse('beep boop bop', {
          convert: {
            unitMaps: [
              new Map(Object.entries({ 'x/': 2 }))
            ]
          }
        });

        expect(uq).toBeNull();
      });

      test('uses a single-element `unitMaps`', () => {
        const uq = UnitQuantity.parse('12 x', {
          convert: {
            unitMaps: [
              new Map(Object.entries({ 'x/': 2 }))
            ]
          }
        });

        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(24);
        expect(uq.unitString).toBe('/');
      });

      test('uses a two-element `unitMaps`', () => {
        const uq = UnitQuantity.parse('7 x per y', {
          convert: {
            unitMaps: [
              new Map(Object.entries({ 'x/': 2, 'xx/': 20 })),
              new Map(Object.entries({ '/y': 3, '/yy': 30 }))
            ]
          }
        });

        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(42);
        expect(uq.unitString).toBe('/');
      });

      test('returns `null` given a value with non-fully-matched units', () => {
        const opts = {
          convert: {
            unitMaps: [
              new Map(Object.entries({ 'x/': 2, 'xx/': 20 })),
              new Map(Object.entries({ '/y': 3, '/yy': 30 }))
            ]
          }
        };

        expect(UnitQuantity.parse('7', opts)).toBeNull();
        expect(UnitQuantity.parse('7 x', opts)).toBeNull();
        expect(UnitQuantity.parse('7 /y', opts)).toBeNull();
        expect(UnitQuantity.parse('7 x/a', opts)).toBeNull();
        expect(UnitQuantity.parse('7 a/y', opts)).toBeNull();
      });
    });

    describe('with `unitMaps` and `resultClass`', () => {
      test('returns `null` given a syntactically incorrect value', () => {
        const uq = UnitQuantity.parse('flippity flop 999', {
          convert: {
            resultClass: FakeUnit,
            unitMaps: [
              new Map(Object.entries({ 'x/': 2 }))
            ]
          }
        });

        expect(uq).toBeNull();
      });

      test('uses a two-element `unitMaps`', () => {
        const uq = UnitQuantity.parse('7 x per y', {
          convert: {
            resultClass: FakeUnit,
            unitMaps: [
              new Map(Object.entries({ 'x/': 2, 'xx/': 20 })),
              new Map(Object.entries({ '/y': 3, '/yy': 30 }))
            ]
          }
        });

        expect(uq).toBeInstanceOf(FakeUnit);
        expect(uq.value).toBe(42);
      });

      test('returns `null` given a value with non-fully-matched units', () => {
        const opts = {
          convert: {
            resultClass: FakeUnit,
            unitMaps: [
              new Map(Object.entries({ 'x/': 2, 'xx/': 20 })),
              new Map(Object.entries({ '/y': 3, '/yy': 30 }))
            ]
          }
        };

        expect(UnitQuantity.parse('7', opts)).toBeNull();
        expect(UnitQuantity.parse('7 x', opts)).toBeNull();
        expect(UnitQuantity.parse('7 /y', opts)).toBeNull();
        expect(UnitQuantity.parse('7 x/a', opts)).toBeNull();
        expect(UnitQuantity.parse('7 a/y', opts)).toBeNull();
      });

      test('returns the given actual-instance argument if it came in with the right units', () => {
        class FakerUnit extends FakeUnit {
          constructor(value) {
            super(value, 'a', 'b');
          }
        }

        const opts = {
          convert: {
            resultClass: FakerUnit,
            unitMaps: [
              new Map(Object.entries({ 'a/': 1, 'aa/': 10 })),
              new Map(Object.entries({ '/b': 1, '/bb': 20 }))
            ]
          }
        };

        const uq = new FakerUnit(914, 'a', 'b');
        expect(UnitQuantity.parse(uq, opts)).toBe(uq);
      });
    });

    describe('with `unitMaps` and `resultUnit`', () => {
      test('returns `null` given a syntactically incorrect value', () => {
        const uq = UnitQuantity.parse('flippity flop 999', {
          convert: {
            resultUnit: 'x/y',
            unitMaps: [
              new Map(Object.entries({ 'x/': 2 }))
            ]
          }
        });

        expect(uq).toBeNull();
      });

      test('uses a two-element `unitMaps`', () => {
        const uq = UnitQuantity.parse('7 x per y', {
          convert: {
            resultUnit: 'a per b',
            unitMaps: [
              new Map(Object.entries({ 'x/': 2, 'xx/': 20 })),
              new Map(Object.entries({ '/y': 3, '/yy': 30 }))
            ]
          }
        });

        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(42);
        expect(uq.unitString).toBe('a/b');
      });

      test('returns `null` given a value with non-fully-matched units', () => {
        const opts = {
          convert: {
            resultUnit: 'a per b',
            unitMaps: [
              new Map(Object.entries({ 'x/': 2, 'xx/': 20 })),
              new Map(Object.entries({ '/y': 3, '/yy': 30 }))
            ]
          }
        };

        expect(UnitQuantity.parse('7', opts)).toBeNull();
        expect(UnitQuantity.parse('7 x', opts)).toBeNull();
        expect(UnitQuantity.parse('7 /y', opts)).toBeNull();
        expect(UnitQuantity.parse('7 x/a', opts)).toBeNull();
        expect(UnitQuantity.parse('7 a/y', opts)).toBeNull();
      });

      test('returns the given actual-instance argument if it came in with the right units', () => {
        const opts = {
          convert: {
            resultUnit: 'a per b',
            unitMaps: [
              new Map(Object.entries({ 'a/': 1, 'aa/': 10 })),
              new Map(Object.entries({ '/b': 1, '/bb': 20 }))
            ]
          }
        };

        const uq = new UnitQuantity(914, 'a', 'b');
        expect(UnitQuantity.parse(uq, opts)).toBe(uq);
      });

      test('uses `convert` before checking `range`', () => {
        const opts = {
          convert: {
            resultUnit: 'a',
            unitMaps: [
              new Map(Object.entries({ 'a/': 1, 'aaa/': 1000 }))
            ]
          },
          range: {
            minInclusive: 1000
          }
        };

        const uq = UnitQuantity.parse('5 aaa', opts);
        expect(uq).toBeInstanceOf(UnitQuantity);
        expect(uq.value).toBe(5000);
        expect(uq.unitString).toBe('a/');
      });
    });
  });

  // Success cases that result in unitless instances.
  test.each`
  value            | expected
  ${'123'}         | ${123}
  ${'999 '}        | ${999}
  ${' 888'}        | ${888}
  ${' 777 '}       | ${777}
  ${'0/'}          | ${0}
  ${'1 /'}         | ${1}
  ${'2_/'}         | ${2}
  ${'3 / '}        | ${3}
  ${'4_/ '}        | ${4}
  ${'5per'}        | ${5}
  ${'6 per'}       | ${6}
  ${'7_per'}       | ${7}
  ${'8 per '}      | ${8}
  ${'9_per '}      | ${9}
  ${'789 ab/ab'}   | ${789} // Units cancel out.
  ${'789 x per x'} | ${789}
  `('returns unitless $expected given `$value`', ({ value, expected }) => {
    const uq = UnitQuantity.parse(value);

    expect(uq).toBeInstanceOf(UnitQuantity);
    expect(uq.value).toBe(expected);
    expect(uq.numeratorUnit).toBeNull();
    expect(uq.denominatorUnit).toBeNull();
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
  ${'123 zz/'}            | ${[123, 'zz', null]}
  ${'4.5 zz /'}           | ${[4.5, 'zz', null]}
  ${'.6 zz per'}          | ${[0.6, 'zz', null]}
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
});

describe('parseUnitSpec()', () => {
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
    expect(() => UnitQuantity.parseUnitSpec(arg)).toThrow();
  });

  // Syntax errors.
  test.each`
  value
  ${'1/a'}           // Invalid character in unit name.
  ${'a/1'}
  ${'a1b/'}
  ${'/a1b'}
  ${'a per 1'}
  ${'1 per a'}
  ${'x_y/'}
  ${'/x_y'}
  ${'$ per'}
  ${'@ per'}
  ${'# per'}
  ${'x  /'}          // Too many spaces / underscores.
  ${'x__/'}
  ${'x_ /'}
  ${'x _/'}
  ${'/  x'}
  ${'/__x'}
  ${'/_ x'}
  ${'/ _x'}
  ${'x  /y'}
  ${'x__/y'}
  ${'x_ /y'}
  ${'x _/y'}
  ${'y/  x'}
  ${'y/__x'}
  ${'y/_ x'}
  ${'y/ _x'}
  ${'x  per'}
  ${'x__per'}
  ${'x_ per'}
  ${'x _per'}
  ${'per  x'}
  ${'per__x'}
  ${'per_ x'}
  ${'per _x'}
  ${'x  per y'}
  ${'x__per y'}
  ${'x_ per y'}
  ${'x _per y'}
  ${'y per  x'}
  ${'y per__x'}
  ${'y per_ x'}
  ${'y per _x'}
  ${'x/y/z'}         // Too many slashes / "per"s.
  ${'x//y'}
  ${'x//'}
  ${'//y'}
  ${'x per y/z'}
  ${'x/y per z'}
  ${'x per y per z'}
  ${'x per per y'}
  ${'x per per'}
  ${'per per y'}
  ${'per z per'}
  ${'per per per'}
  ${'abcdefghijx'}   // Name too long.
  ${'abcdefghijx/'}
  ${'/abcdefghijx'}
  `('returns `null` given `$value`', ({ value }) => {
    expect(UnitQuantity.parseUnitSpec(value)).toBeNull();
  });

  // Success cases.
  test.each`
  spec                           | expected
  ${''}                          | ${[null, null]}
  ${' '}                         | ${[null, null]}
  ${'  '}                        | ${[null, null]}
  ${'/'}                         | ${[null, null]}
  ${'/ '}                        | ${[null, null]}
  ${' /'}                        | ${[null, null]}
  ${' / '}                       | ${[null, null]}
  ${'  /  '}                     | ${[null, null]}
  ${'per'}                       | ${[null, null]}
  ${'per '}                      | ${[null, null]}
  ${' per'}                      | ${[null, null]}
  ${' per '}                     | ${[null, null]}
  ${'  per  '}                   | ${[null, null]}
  ${'x'}                         | ${['x', null]}
  ${'xyz'}                       | ${['xyz', null]}
  ${' x'}                        | ${['x', null]}
  ${'x '}                        | ${['x', null]}
  ${'  x'}                       | ${['x', null]}
  ${'x  '}                       | ${['x', null]}
  ${'  x  '}                     | ${['x', null]}
  ${'x/'}                        | ${['x', null]}
  ${'x /'}                       | ${['x', null]}
  ${'x_/'}                       | ${['x', null]}
  ${' x_/'}                      | ${['x', null]}
  ${'x per'}                     | ${['x', null]}
  ${'x_per'}                     | ${['x', null]}
  ${' x per '}                   | ${['x', null]}
  ${'/x'}                        | ${[null, 'x']}
  ${'/ x'}                       | ${[null, 'x']}
  ${'/_x'}                       | ${[null, 'x']}
  ${'/_x '}                      | ${[null, 'x']}
  ${'per x'}                     | ${[null, 'x']}
  ${'per_x'}                     | ${[null, 'x']}
  ${' per x '}                   | ${[null, 'x']}
  ${'x/y'}                       | ${['x', 'y']}
  ${'x /y'}                      | ${['x', 'y']}
  ${'x/ y'}                      | ${['x', 'y']}
  ${'x / y'}                     | ${['x', 'y']}
  ${'x_/y'}                      | ${['x', 'y']}
  ${'x/_y'}                      | ${['x', 'y']}
  ${'x_/_y'}                     | ${['x', 'y']}
  ${'x_/ y'}                     | ${['x', 'y']}
  ${'x /_y'}                     | ${['x', 'y']}
  ${'  x/y  '}                   | ${['x', 'y']}
  ${'x per y'}                   | ${['x', 'y']}
  ${'x_per y'}                   | ${['x', 'y']}
  ${'x per_y'}                   | ${['x', 'y']}
  ${'x_per_y'}                   | ${['x', 'y']}
  ${'abcdefghij/kkkkklllll'}     | ${['abcdefghij', 'kkkkklllll']}
  ${'abcdefghij per kkkkklllll'} | ${['abcdefghij', 'kkkkklllll']}
  ${'xyz/xyz'}                   | ${[null, null]} // Units cancel out.
  `('returns $expected given `$spec`', ({ spec, expected }) => {
    const result = UnitQuantity.parseUnitSpec(spec);

    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(2);
    expect(result).toEqual(expected);
  });
});
