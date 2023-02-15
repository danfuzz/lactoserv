// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
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
