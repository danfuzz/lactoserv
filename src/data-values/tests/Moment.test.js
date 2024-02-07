// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration, Moment } from '@this/data-values';


describe('constructor()', () => {
  test.each`
  value
  ${0}
  ${0.1}
  ${-10}
  ${9999999999}
  ${1234n}
  `('accepts $value', ({ value }) => {
    expect(() => new Moment(value)).not.toThrow();
  });

  test.each`
  value
  ${undefined}
  ${null}
  ${Number.POSITIVE_INFINITY}
  ${[1, 2, 3]}
  `('throws given $value', ({ value }) => {
    expect(() => new Moment(value)).toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Moment(123)).toBeFrozen();
  });
});

describe('.atSec', () => {
  test('returns the value from the constructor', () => {
    expect(new Moment(0).atSec).toBe(0);
    expect(new Moment(123).atSec).toBe(123);
    expect(new Moment(456.789).atSec).toBe(456.789);
  });

  test('returns a converted bigint', () => {
    expect(new Moment(123999n).atSec).toBe(123999);
  });
});

describe('.atMsec', () => {
  test('returns the value from the constructor, multiplied by 1000', () => {
    expect(new Moment(0).atMsec).toBe(0);
    expect(new Moment(123).atMsec).toBe(123000);
    expect(new Moment(456.789).atMsec).toBe(456789);
  });
});

describe.each`
methodName
${'equals'}
${'isAfter'}
${'isBefore'}
`('$methodName()', ({ methodName }) => {
  test.each`
  m1          | m2          | equals   | isAfter  | isBefore
  ${0}        | ${0}        | ${true}  | ${false} | ${false}
  ${0}        | ${1}        | ${false} | ${false} | ${true}
  ${1}        | ${0}        | ${false} | ${true}  | ${false}
  ${100.9}    | ${100.9001} | ${false} | ${false} | ${true}
  ${9999.999} | ${9999.998} | ${false} | ${true}  | ${false}
  ${12345678} | ${12345678} | ${true}  | ${false} | ${false}
  `('works for ($m1, $m2)', ({ m1, m2, ...expected }) => {
    const mo1    = new Moment(m1);
    const mo2    = new Moment(m2);
    const result = mo1[methodName](mo2);

    expect(result).toBe(expected[methodName]);
  });
});

describe.each`
methodName  | passDuration
${'add'}    | ${true}
${'addSec'} | ${false}
`('$methodName()', ({ methodName, passDuration }) => {
  test.each`
  moment        | secs       | expected
  ${12345}      | ${0}       | ${12345}
  ${10000000}   | ${54321}   | ${10054321}
  ${1600000000} | ${-999888} | ${1599000112}
  `('works given ($moment, $secs)', ({ moment, secs, expected }) => {
    const mobj   = new Moment(moment);
    const arg    = passDuration ? new Duration(secs) : secs;
    const result = mobj[methodName](arg);

    expect(result.atSec).toBe(expected);
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
method                 | isStatic
${'httpStringFromSec'} | ${true}
${'toHttpString'}      | ${false}
`('$method()', ({ method, isStatic }) => {
  // Failure cases.
  test.each`
  atSec
  ${NaN}
  ${+Infinity}
  ${-Infinity}
  ${undefined}
  ${null}
  ${'12345'}
  ${[12345]}
  `('fails given $atSec', ({ atSec }) => {
    const doIt = () => {
      return isStatic
        ? Moment[method](atSec)
        : new Moment(atSec)[method]();
    };

    expect(doIt).toThrow();
  });

  // Success cases.
  test.each`
  atSec         | expected
  ${0}          | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${0.00001}    | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${0.1}        | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${0.99999}    | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${631155661n} | ${'Mon, 01 Jan 1990 01:01:01 GMT'}
  ${631155661}  | ${'Mon, 01 Jan 1990 01:01:01 GMT'}
  ${631245722}  | ${'Tue, 02 Jan 1990 02:02:02 GMT'}
  ${631335783}  | ${'Wed, 03 Jan 1990 03:03:03 GMT'}
  ${631425844}  | ${'Thu, 04 Jan 1990 04:04:04 GMT'}
  ${631515905}  | ${'Fri, 05 Jan 1990 05:05:05 GMT'}
  ${631605966}  | ${'Sat, 06 Jan 1990 06:06:06 GMT'}
  ${631696027}  | ${'Sun, 07 Jan 1990 07:07:07 GMT'}
  ${631786088}  | ${'Mon, 08 Jan 1990 08:08:08 GMT'}
  ${631876149}  | ${'Tue, 09 Jan 1990 09:09:09 GMT'}
  ${631966210}  | ${'Wed, 10 Jan 1990 10:10:10 GMT'}
  ${632059994}  | ${'Thu, 11 Jan 1990 12:13:14 GMT'}
  ${982873840}  | ${'Thu, 22 Feb 2001 20:30:40 GMT'}
  ${985304085}  | ${'Thu, 22 Mar 2001 23:34:45 GMT'}
  ${988004327}  | ${'Mon, 23 Apr 2001 05:38:47 GMT'}
  ${991265551}  | ${'Wed, 30 May 2001 23:32:31 GMT'}
  ${991952480}  | ${'Thu, 07 Jun 2001 22:21:20 GMT'}
  ${994622399}  | ${'Sun, 08 Jul 2001 19:59:59 GMT'}
  ${998113621}  | ${'Sat, 18 Aug 2001 05:47:01 GMT'}
  ${1001652489} | ${'Fri, 28 Sep 2001 04:48:09 GMT'}
  ${1004527353} | ${'Wed, 31 Oct 2001 11:22:33 GMT'}
  ${1004577804} | ${'Thu, 01 Nov 2001 01:23:24 GMT'}
  ${1007885236} | ${'Sun, 09 Dec 2001 08:07:16 GMT'}
  `('with ($atSec)', ({ atSec, expected }) => {
    const result = isStatic
      ? Moment[method](atSec)
      : new Moment(atSec)[method]();

    expect(result).toBe(expected);
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
  atSec               | options                           | expected
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
  `('with ($atSec, $options)', ({ atSec, options, expected }) => {
    const result = isStatic
      ? Moment[method](atSec, options)
      : new Moment(atSec)[method](options);

    if (returnsObject) {
      expect(result).toStrictEqual({ atSec, utc: expected });
    } else {
      expect(result).toBe(expected);
    }
  });
});

describe('fromMsec()', () => {
  test('produces an instance with 1/1000 the given value', () => {
    for (let atMsec = -12345; atMsec < 1999988877; atMsec += 10000017) {
      const result = Moment.fromMsec(atMsec);
      expect(result.atSec).toBe(atMsec / 1000);
    }
  });
});
