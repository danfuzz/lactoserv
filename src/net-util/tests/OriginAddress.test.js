// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EndpointAddress } from '@this/net-util';


describe('constructor', () => {
  // Failure cases for address argument.
  test.each`
  arg
  ${undefined}
  ${false}
  ${1}
  ${['x']}
  ${''}
  ${'foo'}
  ${'foo.bar'}
  ${'999.88.7.6'}
  ${'[127.0.0.1]'}
  ${'z::1234'}
  `('fails when passing address as $arg', ({ arg }) => {
    expect(() => new EndpointAddress(arg, 1)).toThrow();
  });

  // Failure cases for port argument.
  test.each`
  arg
  ${undefined}
  ${false}
  ${''}
  ${'x'}
  ${'!'}
  ${['x']}
  ${-1}
  ${0}
  ${0.5}
  ${65535.9}
  ${65536}
  `('fails when passing portNumber as $arg', ({ arg }) => {
    expect(() => new EndpointAddress('127.0.0.1', arg)).toThrow();
  });

  test('accepts `null` for `address`', () => {
    expect(() => new EndpointAddress(null, 1)).not.toThrow();
  });

  test('accepts a valid IPv4 address', () => {
    expect(() => new EndpointAddress('10.0.0.255', 1)).not.toThrow();
  });

  test('accepts a valid IPv6 address without brackets', () => {
    expect(() => new EndpointAddress('1234:abcd::99:f', 1)).not.toThrow();
  });

  test('accepts a valid IPv6 address with brackets', () => {
    expect(() => new EndpointAddress('1::2:3:cba9', 1)).not.toThrow();
  });

  test('accepts `null` for `portNumber`', () => {
    expect(() => new EndpointAddress('123.42.1.0', null)).not.toThrow();
  });

  test('accepts valid port numbers', () => {
    expect(() => new EndpointAddress('127.0.0.1', 1)).not.toThrow();
    expect(() => new EndpointAddress('127.0.0.1', 65535)).not.toThrow();
  });
});

describe('.address', () => {
  test.each`
  address                                      | expected
  ${null}                                      | ${null}
  ${'1.2.3.4'}                                 | ${'1.2.3.4'}
  ${'01.2.3.4'}                                | ${'1.2.3.4'}
  ${'1.02.3.4'}                                | ${'1.2.3.4'}
  ${'1.2.03.4'}                                | ${'1.2.3.4'}
  ${'1.2.3.04'}                                | ${'1.2.3.4'}
  ${'01.02.003.004'}                           | ${'1.2.3.4'}
  ${'1:2::3:4'}                                | ${'1:2::3:4'}
  ${'[1:2::3:4]'}                              | ${'1:2::3:4'}
  ${'01:2:0::3:04'}                            | ${'1:2::3:4'}
  ${'abcd:1234:5678:fedc:9876:5432:2222:1111'} | ${'abcd:1234:5678:fedc:9876:5432:2222:1111'}
  `('is `$expected` when constructed with `$address`)', ({ address, expected }) => {
    const oa = new EndpointAddress(address, 1);
    expect(oa.address).toBe(expected);
  });
});

describe('.portNumber', () => {
  test('is the number passed in the constructor', () => {
    const oa1 = new EndpointAddress('4.3.2.1', 1);
    const oa2 = new EndpointAddress('4.3.2.1', 9876);

    expect(oa1.portNumber).toBe(1);
    expect(oa2.portNumber).toBe(9876);
  });

  test('is `null` if constructed with `portNumber === null`', () => {
    const oa = new EndpointAddress('4.3.2.1', null);

    expect(oa.portNumber).toBeNull();
  });
});

describe('toString()', () => {
  test.each`
  args                         | expected
  ${[null, null]}              | ${'<unknown>'}
  ${[null, 123]}               | ${'<unknown>:123'}
  ${['1.2.3.4', null]}         | ${'1.2.3.4'}
  ${['111::fff', null]}        | ${'[111::fff]'}
  ${['44.33.22.11', 789]}      | ${'44.33.22.11:789'}
  ${['abcd:ef::43:210', 7654]} | ${'[abcd:ef::43:210]:7654'}
  `('given $args returns `$expected`', ({ args, expected }) => {
    const oa = new EndpointAddress(...args);
    expect(oa.toString()).toBe(expected);
  });

  test('works on a second call (checks caching behavior)', () => {
    const oa       = new EndpointAddress('55.5.55.5', 555);
    const expected = '55.5.55.5:555';

    expect(oa.toString()).toBe(expected);
    expect(oa.toString()).toBe(expected);
  })
});
