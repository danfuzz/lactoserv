// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration } from '@this/data-values';


describe('constructor()', () => {
  test.each`
  value
  ${0}
  ${0.1}
  ${-10}
  ${9999999999}
  `('accepts $value', ({ value }) => {
    expect(() => new Duration(value)).not.toThrow();
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
    expect(() => new Duration(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Duration(123)).toBeFrozen();
  });
});

describe('.sec', () => {
  test('returns the value from the constructor', () => {
    expect(new Duration(0).sec).toBe(0);
    expect(new Duration(123).sec).toBe(123);
    expect(new Duration(456.789).sec).toBe(456.789);
  });
});

describe.each`
method                  | isStatic  | returnsObject
${'stringFromSec'}      | ${true}   | ${false}
${'plainObjectFromSec'} | ${true}   | ${true}
${'toPlainObject'}      | ${false}  | ${true}
${'toString'}           | ${false}  | ${false}
`('$method()', ({ method, isStatic, returnsObject }) => {
  test.each`
  sec                  | duration
  ${-999.123}          | ${'-999.123 sec'}
  ${-1}                | ${'-1.000 sec'}
  ${0}                 | ${'0 sec (instantaneous)'}
  ${0.000000000000009} | ${'0.000 nsec'}
  ${0.00000000000009}  | ${'0.000 nsec'}
  ${0.0000000000001}   | ${'0.000 nsec'}
  ${0.0000000000009}   | ${'0.001 nsec'}
  ${0.000000000001}    | ${'0.001 nsec'}
  ${0.0000000012347}   | ${'1.235 nsec'}
  ${0.000000909}       | ${'909.000 nsec'}
  ${0.000000999999}    | ${'999.999 nsec'}
  ${0.0000009999996}   | ${'1.000 usec'}
  ${0.0000012347}      | ${'1.235 usec'}
  ${0.0007773325001}   | ${'777.333 usec'}
  ${0.000999999}       | ${'999.999 usec'}
  ${0.00099999949}     | ${'999.999 usec'}
  ${0.0009999995001}   | ${'1.000 msec'}
  ${0.0012347}         | ${'1.235 msec'}
  ${0.43298654}        | ${'432.987 msec'}
  ${0.999}             | ${'999.000 msec'}
  ${0.9999}            | ${'999.900 msec'}
  ${0.99999}           | ${'999.990 msec'}
  ${0.999999}          | ${'999.999 msec'}
  ${0.9999994999}      | ${'999.999 msec'}
  ${0.999999500001}    | ${'1.000 sec'}
  ${1}                 | ${'1.000 sec'}
  ${1.0009}            | ${'1.001 sec'}
  ${1.2347}            | ${'1.235 sec'}
  ${99.176}            | ${'99.176 sec'}
  ${99.999}            | ${'99.999 sec'}
  ${99.99949999}       | ${'99.999 sec'}
  ${99.9995}           | ${':01:40.0'}
  ${99.999500001}      | ${':01:40.0'}
  ${100}               | ${':01:40.0'}
  ${100.1}             | ${':01:40.1'}
  ${100.9}             | ${':01:40.9'}
  ${100.94999}         | ${':01:40.9'}
  ${100.95001}         | ${':01:41.0'}
  ${101.04}            | ${':01:41.0'}
  ${101.05001}         | ${':01:41.1'}
  ${101.23}            | ${':01:41.2'}
  ${3599}              | ${':59:59.0'}
  ${3599.9}            | ${':59:59.9'}
  ${3599.949}          | ${':59:59.9'}
  ${3599.950001}       | ${'1:00:00'}
  ${3600}              | ${'1:00:00'}
  ${3600.1}            | ${'1:00:00'}
  ${3600.50001}        | ${'1:00:01'}
  ${32400}             | ${'9:00:00'}
  ${35999}             | ${'9:59:59'}
  ${36000}             | ${'10:00:00'}
  ${86399}             | ${'23:59:59'}
  ${86399.0001}        | ${'23:59:59'}
  ${86400}             | ${'1d 0:00:00'}
  ${86400.654}         | ${'1d 0:00:01'}
  ${90000}             | ${'1d 1:00:00'}
  ${127353}            | ${'1d 11:22:33'}
  ${49021687.1}        | ${'567d 9:08:07'}
  ${49021687.9}        | ${'567d 9:08:08'}
  `('with ($sec)', ({ sec, duration }) => {
    const result = isStatic
      ? Duration[method](sec)
      : new Duration(sec)[method]();

    if (returnsObject) {
      expect(result).toStrictEqual({ sec, duration });
    } else {
      expect(result).toBe(duration);
    }
  });
});

// A couple extra cases for this method (after the above), to check the
// `options` behavior.
describe('stringFromSec()', () => {
  test.each`
  sec              | options              | duration
  ${-1.23}         | ${undefined}         | ${'-1.230 sec'}
  ${0}             | ${undefined}         | ${'0 sec (instantaneous)'}
  ${9.876}         | ${undefined}         | ${'9.876 sec'}
  ${0.09876}       | ${undefined}         | ${'98.760 msec'}
  ${0.00009876}    | ${undefined}         | ${'98.760 usec'}
  ${0.00000009876} | ${undefined}         | ${'98.760 nsec'}
  ${-1.23}         | ${{ spaces: true }}  | ${'-1.230 sec'}
  ${0}             | ${{ spaces: true }}  | ${'0 sec (instantaneous)'}
  ${9.876}         | ${{ spaces: true }}  | ${'9.876 sec'}
  ${0.09876}       | ${{ spaces: true }}  | ${'98.760 msec'}
  ${0.00009876}    | ${{ spaces: true }}  | ${'98.760 usec'}
  ${0.00000009876} | ${{ spaces: true }}  | ${'98.760 nsec'}
  ${-1.23}         | ${{ spaces: false }} | ${'-1.230_sec'}
  ${0}             | ${{ spaces: false }} | ${'0_sec'}
  ${9.876}         | ${{ spaces: false }} | ${'9.876_sec'}
  ${0.09876}       | ${{ spaces: false }} | ${'98.760_msec'}
  ${0.00009876}    | ${{ spaces: false }} | ${'98.760_usec'}
  ${0.00000009876} | ${{ spaces: false }} | ${'98.760_nsec'}
  `('with ($sec, $options)', ({ sec, options, duration }) => {
    const result = Duration.stringFromSec(sec, options);
    expect(result).toBe(duration);
  });
});

describe('.ZERO', () => {
  test('has the value `0`', () => {
    expect(Duration.ZERO.sec).toBe(0);
  });
});

describe.each`
methodName    | returns
${'parse'}    | ${'object'}
${'parseSec'} | ${'number'}
`('$methodName()', ({ methodName, returns }) => {
  // Error: Wrong argument type.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${123}
  ${['123s']}
  ${new Map()}
  ${new Duration(10)}
  `('throws given $arg', ({ arg }) => {
    expect(() => Duration[methodName](arg)).toThrow();
  });

  // Error: Syntax error / unknown unit.
  test.each`
  arg
  ${''}
  ${'123'}       // No unit.
  ${'hr'}        // No number.
  ${'1 x'}       // Unknown unit.
  ${'1 s_ec'}    // Unknown unit.
  ${'1z sec'}    // Invalid character in number.
  ${'$1 sec'}    // Ditto.
  ${'1  sec'}    // Too many spaces after number.
  ${'1 2 sec'}   // No spaces in number.
  ${'_1 sec'}    // Leading underscore not allowed.
  ${'1_ sec'}    // Trailing underscore not allowed (with space after).
  ${'1__2 sec'}  // Double underscores not allowed in number.
  ${'3__sec'}    // Double underscores not allowed after number.
  ${'1._2 sec'}  // Underscore not allowed next to dot.
  ${'1_.2 sec'}  // Ditto.
  ${'1e2e3 sec'} // At most one exponent.
  ${'1e1.2 sec'} // No fractional exponent.
  ${'. sec'}     // Generally invalid number syntax, as are all the rest...
  ${'..1 sec'}
  ${'1.. sec'}
  ${'1..2 sec'}
  ${'e1 sec'}
  ${'E1 sec'}
  ${'.e sec'}
  ${'.e1 sec'}
  ${'1ee1 sec'}
  ${'++1 sec'}
  ${'--1 sec'}
  ${'+-1 sec'}
  ${'-+1 sec'}
  ${'1+ sec'}
  ${'1- sec'}
  ${'1+1 sec'}
  ${'1-1 sec'}
  ${'1e sec'}
  ${'1E sec'}
  ${'1e+ sec'}
  ${'1E- sec'}
  ${'1e+ sec'}
  ${'1E- sec'}
  ${'1e++1 sec'}
  ${'1e--1 sec'}
  ${'1e1+ sec'}
  ${'1e1- sec'}
  ${'1e1+1 sec'}
  ${'1e1-1 sec'}
  `('returns `null` given $arg', ({ arg }) => {
    expect(Duration[methodName](arg)).toBeNull();
  });

  // Success cases
  test.each`
  arg                     | expected
  ${'0 nsec'}             | ${0}
  ${'0 ns'}               | ${0}
  ${'0 usec'}             | ${0}
  ${'0 us'}               | ${0}
  ${'0 msec'}             | ${0}
  ${'0 ms'}               | ${0}
  ${'0 sec'}              | ${0}
  ${'0 s'}                | ${0}
  ${'0 min'}              | ${0}
  ${'0 m'}                | ${0}
  ${'0 hr'}               | ${0}
  ${'0 h'}                | ${0}
  ${'0 day'}              | ${0}
  ${'0 d'}                | ${0}
  ${'0 sec'}              | ${0}
  ${'1_000_000_000 nsec'} | ${1}
  ${'1_000_000_000 ns'}   | ${1}
  ${'1_000_000 usec'}     | ${1}
  ${'1_000_000 us'}       | ${1}
  ${'1_000 msec'}         | ${1}
  ${'1_000 ms'}           | ${1}
  ${'1 sec'}              | ${1}
  ${'1 s'}                | ${1}
  ${'1 min'}              | ${60}
  ${'1 m'}                | ${60}
  ${'1 hr'}               | ${3600}
  ${'1 h'}                | ${3600}
  ${'1 day'}              | ${86400}
  ${'1 d'}                | ${86400}
  ${'234.567_nsec'}       | ${0.000000234567}
  ${'234.567_ns'}         | ${0.000000234567}
  ${'234.567_usec'}       | ${0.000234567}
  ${'234.567_us'}         | ${0.000234567}
  ${'234.567_msec'}       | ${234.567 * (1 / 1000)} // Hooray for floating point!
  ${'234.567_ms'}         | ${234.567 * (1 / 1000)}
  ${'234.567_sec'}        | ${234.567}
  ${'234.567_s'}          | ${234.567}
  ${'234.567_min'}        | ${234.567 * 60}
  ${'234.567_m'}          | ${234.567 * 60}
  ${'234.567_hr'}         | ${234.567 * 60 * 60}
  ${'234.567_h'}          | ${234.567 * 60 * 60}
  ${'234.567_day'}        | ${234.567 * 60 * 60 * 24}
  ${'234.567_d'}          | ${234.567 * 60 * 60 * 24}
  ${'023 s'}              | ${23}
  ${'0.1 s'}              | ${0.1}
  ${'123.1 s'}            | ${123.1}
  ${'-1 s'}               | ${-1}
  ${'-2.987 s'}           | ${-2.987}
  ${'+3 s'}               | ${3}
  ${'+4.567_890 s'}       | ${4.56789}
  ${'2e1 s'}              | ${20}
  ${'2e+1 s'}             | ${20}
  ${'2e+02 s'}            | ${200}
  ${'2e-1 s'}             | ${0.2}
  ${'2e+0 s'}             | ${2}
  ${'2e-0 s'}             | ${2}
  `('returns $expected given $arg', ({ arg, expected }) => {
    const result = Duration[methodName](arg);

    if (returns === 'object') {
      expect(result).toBeInstanceOf(Duration);
      expect(result.sec).toBe(expected);
    } else {
      expect(result).toBe(expected);
    }
  });
});
