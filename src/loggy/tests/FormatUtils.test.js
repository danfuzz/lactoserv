// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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

describe('byteCountString()', () => {
  describe.each`
  spaces   | options
  ${true}  | ${undefined}
  ${true}  | ${{}}
  ${true}  | ${{ spaces: true }}
  ${false} | ${{ spaces: false }}
  `('with options $options', ({ spaces, options }) => {
    test.each`
    count        | expected
    ${null}      | ${'<none>'}
    ${0}         | ${'0 B'}
    ${1}         | ${'1 B'}
    ${1023}      | ${'1023 B'}
    ${1024}      | ${'1024 B'}
    ${99999}     | ${'99999 B'}
    ${100000}    | ${'97.66 kB'}
    ${100008}    | ${'97.66 kB'}
    ${100009}    | ${'97.67 kB'}
    ${102400}    | ${'100 kB'}
    ${102401}    | ${'100.00 kB'}
    ${10239999}  | ${'10000.00 kB'}
    ${10240000}  | ${'9.77 MB'}
    ${102400000} | ${'97.66 MB'}
    ${104857600} | ${'100 MB'}
    `('with ($count)', ({ count, expected }) => {
      const args = [count];
      if (options !== undefined) {
        args.push(options);
      }

      const finalExpected = spaces
        ? expected
        : expected.replace(/ /, '_');

      expect(FormatUtils.byteCountString(...args)).toBe(finalExpected);
    });
  });
});

describe.each`
method
${'dateTimeStringFromSecs'}
${'compoundDateTimeFromSecs'}
`('$method()', ({ method }) => {
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
    const result = FormatUtils[method](atSecs, options);
    if (method === 'dateTimeStringFromSecs') {
      expect(result).toBe(expected);
    } else {
      expect(result).toStrictEqual({ atSecs, utc: expected });
    }
  });
});

describe.each`
method
${'durationStringFromSecs'}
${'compoundDurationFromSecs'}
`('$method()', ({ method }) => {
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
    const result = FormatUtils[method](secs);
    if (method === 'durationStringFromSecs') {
      expect(result).toBe(duration);
    } else {
      expect(result).toStrictEqual({ secs, duration });
    }
  });
});

// A couple extra cases for this method (after the above), to check the
// `options` behavior.
describe('durationStringFromSecs()', () => {
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
    const result = FormatUtils.durationStringFromSecs(secs, options);
    expect(result).toBe(duration);
  });
});
