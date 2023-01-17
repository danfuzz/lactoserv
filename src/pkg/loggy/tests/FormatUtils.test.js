// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { FormatUtils } from '@this/loggy';


describe('addressPortString()', () => {
  test.each`
  address                                      | port     | expected
  ${'1234:5678:9abc:def0:0987:6543:210a:bcde'} | ${65432} | ${'[1234:5678:9abc:def0:0987:6543:210a:bcde]:65432'}
  ${'123.255.199.126'}                         | ${54321} | ${'123.255.199.126:54321'}
  ${'::ffff:123.255.199.126'}                  | ${12345} | ${'123.255.199.126:12345'}
  ${'1234:5678:9abc:def0:0987:6543:210a:bcde'} | ${null}  | ${'[1234:5678:9abc:def0:0987:6543:210a:bcde]'}
  ${'123.255.199.126'}                         | ${null}  | ${'123.255.199.126'}
  ${'::ffff:123.255.199.126'}                  | ${null}  | ${'123.255.199.126'}
  ${null}                                      | ${0}     | ${'<unknown>:0'}
  ${null}                                      | ${1}     | ${'<unknown>:1'}
  ${null}                                      | ${10000} | ${'<unknown>:10000'}
  ${null}                                      | ${null}  | ${'<unknown>'}
  ${'::'}                                      | ${123}   | ${'[::]:123'}
  ${'::ffff:abcd'}                             | ${99}    | ${'[::ffff:abcd]:99'}
  ${'123::ffff:432'}                           | ${7777}  | ${'[123::ffff:432]:7777'}
  `('with ($address, $port)', ({ address, port, expected }) => {
    expect(FormatUtils.addressPortString(address, port)).toBe(expected);
  });
});

describe('contentLengthString()', () => {
  test.each`
  length       | expected
  ${null}      | ${'<unknown-length>'}
  ${0}         | ${'0B'}
  ${1}         | ${'1B'}
  ${1023}      | ${'1023B'}
  ${1024}      | ${'1024B'}
  ${99999}     | ${'99999B'}
  ${100000}    | ${'97.66kB'}
  ${100008}    | ${'97.66kB'}
  ${100009}    | ${'97.67kB'}
  ${102400}    | ${'100kB'}
  ${102401}    | ${'100.00kB'}
  ${10239999}  | ${'10000.00kB'}
  ${10240000}  | ${'9.77MB'}
  ${102400000} | ${'97.66MB'}
  ${104857600} | ${'100MB'}
  `('with ($length)', ({ length, expected }) => {
    expect(FormatUtils.contentLengthString(length)).toBe(expected);
  });
});

describe.each`
method
${'dateTimeStringFromSecs'}
${'compoundDateTimeFromSecs'}
`('$method()', ({ method }) => {
  test.each`
  secs                | options                           | expected
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
  `('with ($secs, $options)', ({ secs, options, expected }) => {
    const result = FormatUtils[method](secs, options);
    if (method === 'dateTimeStringFromSecs') {
      expect(result).toBe(expected);
    } else {
      expect(result).toStrictEqual({ secs, utc: expected });
    }
  });
});

describe('compoundDurationFromSecs()', () => {
  test.each`
  secs               | duration
  ${-999.123}        | ${'-999.123 sec'}
  ${-1}              | ${'-1.000 sec'}
  ${0}               | ${'0 sec (instantaneous)'}
  ${0.0000000012347} | ${'1.235 nsec'}
  ${0.000000909}     | ${'909.000 nsec'}
  ${0.000000999999}  | ${'999.999 nsec'}
  ${0.0000009999996} | ${'1.000 usec'}
  ${0.0000012347}    | ${'1.235 usec'}
  ${0.0007773325001} | ${'777.333 usec'}
  ${0.000999999}     | ${'999.999 usec'}
  ${0.00099999949}   | ${'999.999 usec'}
  ${0.0009999995001} | ${'1.000 msec'}
  ${0.0012347}       | ${'1.235 msec'}
  ${0.43298654}      | ${'432.987 msec'}
  ${0.999}           | ${'999.000 msec'}
  ${0.9999}          | ${'999.900 msec'}
  ${0.99999}         | ${'999.990 msec'}
  ${0.999999}        | ${'999.999 msec'}
  ${0.9999994999}    | ${'999.999 msec'}
  ${0.999999500001}  | ${'1.000 sec'}
  ${1}               | ${'1.000 sec'}
  ${1.0009}          | ${'1.001 sec'}
  ${1.2347}          | ${'1.235 sec'}
  ${99.176}          | ${'99.176 sec'}
  ${99.999}          | ${'99.999 sec'}
  ${99.9995}         | ${'99.999 sec'}
  ${99.999500001}    | ${'01:40'}
  ${100}             | ${'01:40'}
  ${101.23}          | ${'01:41'}
  ${101.5001}        | ${'01:42'}
  ${3599}            | ${'59:59'}
  ${3600}            | ${'01:00:00'}
  ${3600.1}          | ${'01:00:00'}
  ${3600.50001}      | ${'01:00:01'}
  ${86399}           | ${'23:59:59'}
  ${86399.0001}      | ${'23:59:59'}
  ${86400}           | ${'1d 00:00:00'}
  ${86400.654}       | ${'1d 00:00:01'}
  ${127353}          | ${'1d 11:22:33'}
  ${49021687.1}      | ${'567d 09:08:07'}
  ${49021687.9}      | ${'567d 09:08:08'}
  `('with ($secs)', ({ secs, duration }) => {
    const expected = { secs, duration };

    expect(FormatUtils.compoundDurationFromSecs(secs)).toEqual(expected);
  });
});

describe('durationString()', () => {
  test.each`
  msec      | expected
  ${0}      | ${'0msec'}
  ${0.01}   | ${'0.01msec'}
  ${0.1}    | ${'0.10msec'}
  ${1}      | ${'1msec'}
  ${1.23}   | ${'1.23msec'}
  ${9.949}  | ${'9.95msec'}
  ${9.95}   | ${'9.95msec'}
  ${9.99}   | ${'9.99msec'}
  ${9.994}  | ${'9.99msec'}
  ${9.9949} | ${'9.99msec'}
  ${9.995}  | ${'10.0msec'}
  ${10}     | ${'10msec'}
  ${10.01}  | ${'10.0msec'}
  ${10.09}  | ${'10.1msec'}
  ${99}     | ${'99msec'}
  ${99.9}   | ${'99.9msec'}
  ${99.99}  | ${'100msec'}
  ${100}    | ${'100msec'}
  ${100.01} | ${'100msec'}
  ${999}    | ${'999msec'}
  ${999.49} | ${'999msec'}
  ${999.51} | ${'1000msec'}
  ${1000}   | ${'1sec'}
  ${1001}   | ${'1.00sec'}
  ${9000}   | ${'9sec'}
  ${9120}   | ${'9.12sec'}
  ${9990}   | ${'9.99sec'}
  ${10000}  | ${'10sec'}
  ${10010}  | ${'10.0sec'}
  ${10900}  | ${'10.9sec'}
  ${99900}  | ${'99.9sec'}
  ${100000} | ${'100sec'}
  ${100100} | ${'100sec'}
  ${100900} | ${'101sec'}
  `('with ($msec)', ({ msec, expected }) => {
    expect(FormatUtils.durationString(msec)).toBe(expected);
  });
});

// TODO: Test the remaining methods.
