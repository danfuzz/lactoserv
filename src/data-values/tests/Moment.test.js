// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment } from '@this/data-values';


describe('constructor()', () => {
  test.each`
  value
  ${0}
  ${0.1}
  ${-10}
  ${9999999999}
  `('accepts $value', ({ value }) => {
    expect(() => new Moment(value)).not.toThrow();
  });

  test.each`
  value
  ${undefined}
  ${null}
  ${123n}
  ${Number.POSITIVE_INFINITY}
  ${[1, 2, 3]}
  `('throws given $value', ({ value }) => {
    expect(() => new Moment(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Moment(123)).toBeFrozen();
  });
});

describe('.atSecs', () => {
  test('returns the value from the constructor', () => {
    expect(new Moment(0).atSecs).toBe(0);
    expect(new Moment(123).atSecs).toBe(123);
    expect(new Moment(456.789).atSecs).toBe(456.789);
  });
});

describe('subtract()', () => {
  test.each`
  m1          | m2           | expected
  ${12345}    | ${12345}     | ${0}
  ${10000002} | ${10000001}  | ${1}
  ${10000001} | ${10000002}  | ${-1}
  `('works given ($m1, $m2)', ({ m1, m2, expected }) => {
    const moment1 = new Moment(m1);
    const moment2 = new Moment(m2);
    const diff    = moment1.subtract(moment2);
    expect(diff.secs).toBe(expected);
  });
});

describe.each`
method                    | isStatic  | returnsObject
${'stringFromSecs'}       | ${true}   | ${false}
${'plainObjectFromSecs'}  | ${true}   | ${true}
${'toPlainObject'}        | ${false}  | ${true}
${'toString'}             | ${false}  | ${false}
`('$method()', ({ method, isStatic, returnsObject }) => {
  test.each`
  atSecs              | options                           | expected
  ${0}                | ${undefined}                      | ${'19700101-00:00:00'}
  ${-14195365}        | ${undefined}                      | ${'19690720-16:50:35'}
  ${1666016999.99999} | ${undefined}                      | ${'20221017-14:29:59'}
  ${1673916141}       | ${undefined}                      | ${'20230117-00:42:21'}
  ${1673916141.1234}  | ${undefined}                      | ${'20230117-00:42:21'}
  ${1673916141.9}     | ${undefined}                      | ${'20230117-00:42:21'}
  ${1673916141}       | ${{ decimals: 0 }}                | ${'20230117-00:42:21'}
  ${1673916141.1234}  | ${{ decimals: 0 }}                | ${'20230117-00:42:21'}
  ${1673916141.9}     | ${{ decimals: 0 }}                | ${'20230117-00:42:21'}
  ${1673916141}       | ${{ decimals: 1 }}                | ${'20230117-00:42:21.0'}
  ${1673916141.1234}  | ${{ decimals: 1 }}                | ${'20230117-00:42:21.1'}
  ${1673916141.16}    | ${{ decimals: 1 }}                | ${'20230117-00:42:21.1'}
  ${1673916141.97}    | ${{ decimals: 1 }}                | ${'20230117-00:42:21.9'}
  ${1673916141}       | ${{ decimals: 4 }}                | ${'20230117-00:42:21.0000'}
  ${1673916141.00008} | ${{ decimals: 4 }}                | ${'20230117-00:42:21.0000'}
  ${1673916141.1234}  | ${{ decimals: 4 }}                | ${'20230117-00:42:21.1234'}
  ${1673916141.12344} | ${{ decimals: 4 }}                | ${'20230117-00:42:21.1234'}
  ${1673916141.12345} | ${{ decimals: 4 }}                | ${'20230117-00:42:21.1234'}
  ${1673916141.12346} | ${{ decimals: 4 }}                | ${'20230117-00:42:21.1234'}
  ${1673916141}       | ${{ colons: false }}              | ${'20230117-004221'}
  ${1673916141.1234}  | ${{ colons: false }}              | ${'20230117-004221'}
  ${1673916141.1234}  | ${{ colons: false, decimals: 1 }} | ${'20230117-004221.1'}
  ${1673916141.1234}  | ${{ colons: false, decimals: 2 }} | ${'20230117-004221.12'}
  ${1673916141}       | ${{ colons: true }}               | ${'20230117-00:42:21'}
  ${1673916141.1234}  | ${{ colons: true }}               | ${'20230117-00:42:21'}
  ${1673916141.1234}  | ${{ colons: true, decimals: 1 }}  | ${'20230117-00:42:21.1'}
  ${1673916141.1234}  | ${{ colons: true, decimals: 2 }}  | ${'20230117-00:42:21.12'}
  `('with ($atSecs, $options)', ({ atSecs, options, expected }) => {
    const result = isStatic
      ? Moment[method](atSecs, options)
      : new Moment(atSecs)[method](options);

    if (returnsObject) {
      expect(result).toStrictEqual({ atSecs, utc: expected });
    } else {
      expect(result).toBe(expected);
    }
  });
});
