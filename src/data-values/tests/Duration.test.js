// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
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
  ${'27s' /* but maybe we want to do this? */}
  ${[1, 2, 3]}
  `('throws given $value', ({ value }) => {
    expect(() => new Duration(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Duration(123)).toBeFrozen();
  });
});

describe('.secs', () => {
  test('returns the value from the constructor', () => {
    expect(new Duration(0).secs).toBe(0);
    expect(new Duration(123).secs).toBe(123);
    expect(new Duration(456.789).secs).toBe(456.789);
  });
});

describe.each`
method                    | isStatic  | returnsObject
${'stringFromSecs'}       | ${true}   | ${false}
${'plainObjectFromSecs'}  | ${true}   | ${true}
${'toPlainObject'}        | ${false}  | ${true}
${'toJSON'}               | ${false}  | ${true}
`('$method()', ({ method, isStatic, returnsObject }) => {
  test.each`
  secs                 | duration
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
  `('with ($secs)', ({ secs, duration }) => {
    const result = isStatic
      ? Duration[method](secs)
      : new Duration(secs)[method]();

    if (returnsObject) {
      expect(result).toStrictEqual({ secs, duration });
    } else {
      expect(result).toBe(duration);
    }
  });
});

// A couple extra cases for this method (after the above), to check the
// `options` behavior.
describe('stringFromSecs()', () => {
  test.each`
  secs             | options              | duration
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
  `('with ($secs, $options)', ({ secs, options, duration }) => {
    const result = Duration.stringFromSecs(secs, options);
    expect(result).toBe(duration);
  });
});
