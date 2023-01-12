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

describe('compoundDurationFromSecs()', () => {
  test.each`
  secs          | hours         | days        | time
  ${0}          | ${null}       | ${null}     | ${'00:00'}
  ${0.1234}     | ${null}       | ${null}     | ${'00:00.1234'}
  ${0.00001}    | ${null}       | ${null}     | ${'00:00.0000'}
  ${59.9999}    | ${null}       | ${null}     | ${'00:59.9999'}
  ${60}         | ${null}       | ${null}     | ${'01:00'}
  ${61}         | ${null}       | ${null}     | ${'01:01'}
  ${69.77}      | ${null}       | ${null}     | ${'01:09.7700'}
  ${3599}       | ${null}       | ${null}     | ${'59:59'}
  ${3600}       | ${1}          | ${null}     | ${'01:00:00'}
  ${3600.1}     | ${1}          | ${null}     | ${'01:00:00.1000'}
  ${86399}      | ${23.9997}    | ${null}     | ${'23:59:59'}
  ${86399.0001} | ${23.9997}    | ${null}     | ${'23:59:59.0001'}
  ${86400}      | ${24}         | ${1}        | ${'1d 00:00:00'}
  ${86400.654}  | ${24.0002}    | ${1}        | ${'1d 00:00:00.6540'}
  ${127353}     | ${35.3758}    | ${1.474}    | ${'1d 11:22:33'}
  ${49021687}   | ${13617.1353} | ${567.3806} | ${'567d 09:08:07'}
  `('with ($secs)', ({ secs, hours, days, time }) => {
    const expected = { secs, hours, days, time };

    if (hours === null) {
      delete expected.hours;
    }

    if (days === null) {
      delete expected.days;
    }

    expect(FormatUtils.compoundDurationFromSecs(secs)).toEqual(expected);
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

describe('elapsedTimeString()', () => {
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
    expect(FormatUtils.elapsedTimeString(msec)).toBe(expected);
  });
});

// TODO: Test the remaining methods.
