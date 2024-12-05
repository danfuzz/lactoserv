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
  });
});


//
// Static members
//

describe.each`
method                         | throws
${'canonicalizeAddress'}       | ${true}
${'canonicalizeAddressOrNull'} | ${false}
`('$method()', ({ method, throws }) => {
  // Failures from passing non-strings. These are always supposed to throw.
  test.each`
  addr
  ${null}
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${Symbol('boop')}
  ${['a', 'b']}
  ${{ a: 'florp' }}
  `('throws for $addr', ({ addr }) => {
    expect(() => EndpointAddress[method](addr, false)).toThrow();
    expect(() => EndpointAddress[method](addr, true)).toThrow();
  });

  // Failure cases.
  test.each`
  label                                    | addr
  ${'empty string'}                        | ${''}
  ${'complete wildcard'}                   | ${'*'}
  ${'wildcard IPv4-ish address'}           | ${'*.23'}
  ${'wildcard IPv4-ish address'}           | ${'*.23.45'}
  ${'wildcard IPv4-ish address'}           | ${'*.2.3.4'}
  ${'wildcard IPv4-ish address'}           | ${'*.2.3.4.56'}
  ${'wildcard IPv6-ish address'}           | ${'*:10::5'}
  ${'DNS name (1 component)'}              | ${'foo'}
  ${'DNS name (2 components)'}             | ${'foo.bar'}
  ${'DNS name (3 components)'}             | ${'foo.bar.baz'}
  ${'wildcard DNS name'}                   | ${'*.foo.bar'}
  ${'DNS-like but with numeric component'} | ${'123.foo'}
  ${'too many IPv6 double colons'}         | ${'123::45::67'}
  ${'IPv6 triple colon'}                   | ${'123:::45:67'}
  ${'too few IPv6 colons'}                 | ${'123:45:67:89:ab'}
  ${'invalid IPv6 digit'}                  | ${'123::g:456'}
  ${'too-long IPv6 component'}             | ${'123::45678:9'}
  ${'too many IPv6 components'}            | ${'1:2:3:4:5:6:7:8:9'}
  ${'too many IPv6 components, with `::`'} | ${'1:2::3:4:5:6:7:8'}
  ${'too many IPv6 components, with `::`'} | ${'1:2::3:4:5:6:7:8:9'}
  ${'too-long IPv4 component'}             | ${'10.0.0.0099'}
  ${'too-large IPv4 component'}            | ${'10.256.0.1'}
  ${'IPv4 in brackets'}                    | ${'[1.2.3.4]'}
  ${'IPv4 with extra char at start'}       | ${'@1.2.3.45'}
  ${'IPv4 with extra char at end'}         | ${'1.2.3.45#'}
  ${'IPv4 with extra dot at start'}        | ${'.12.2.3.45'}
  ${'IPv4 with extra dot at end'}          | ${'14.25.37.24.'}
  ${'DNS name in brackets'}                | ${'[foo.bar]'}
  ${'IPv6 missing open bracket'}           | ${'1:2:3::4]'}
  ${'IPv6 missing close bracket'}          | ${'[aa:bc::d:e:f'}
  ${'IPv6 with extra at start'}            | ${'xaa:bc::1:2:34'}
  ${'IPv6 with extra at end'}              | ${'aa:bc::1:2:34z'}
  ${'IPv4-in-v6 but with wrong prefix'}    | ${'1234::78:10.20.30.40'}
  `('fails for $label', ({ addr }) => {
    if (throws) {
      expect(() => EndpointAddress[method](addr, false)).toThrow();
      expect(() => EndpointAddress[method](addr, true)).toThrow();
    } else {
      expect(EndpointAddress[method](addr, false)).toBeNull();
      expect(EndpointAddress[method](addr, true)).toBeNull();
    }
  });

  // Success cases that are given in canonical form.
  test.each`
  addr
  ${'10.0.0.1'}
  ${'255.255.255.255'}
  ${'199.199.199.199'}
  ${'99.99.99.99'}
  ${'::a'}
  ${'1::'}
  ${'123:4567:89ab:cdef:123:4567:89ab:cdef'}
  ${'123:4567:89ab::123:4567:89ab:cdef'}
  ${'123:4567::1230:4567:89ab:cdef'}
  ${'123:4567::4567:89ab:cdef'}
  ${'123::4567:89ab:cdef'}
  ${'123::4567:89ab'}
  ${'123::4567'}
  ${'abcd::ef'}
  ${'::abcd'}
  ${'::ffff:11.22.33.44'} // IPv4-in-v6 wrapped form
  `('succeeds for $addr', ({ addr }) => {
    expect(EndpointAddress[method](addr, false)).toBe(addr);
    expect(EndpointAddress[method](addr, true)).toBe(addr);
  });

  // Success cases that are given in non-canonical form.
  test.each`
  addr                                         | expected
  ${'010.0.0.1'}                               | ${'10.0.0.1'}
  ${'10.02.0.1'}                               | ${'10.2.0.1'}
  ${'10.0.004.1'}                              | ${'10.0.4.1'}
  ${'123.0.0.09'}                              | ${'123.0.0.9'}
  ${'123.0.0.009'}                             | ${'123.0.0.9'}
  ${'123.0.09.1'}                              | ${'123.0.9.1'}
  ${'123.0.009.1'}                             | ${'123.0.9.1'}
  ${'0:0:0:0:0:0:0:a'}                         | ${'::a'}
  ${'1:0:0:0:0:0:0:0'}                         | ${'1::'}
  ${'3:0:0:0:0:0:0:4'}                         | ${'3::4'}
  ${'00:00:00:00:00:00:00:a'}                  | ${'::a'}
  ${'1:00:00:00:00:00:00:00'}                  | ${'1::'}
  ${'3:00:00:00:00:00:00:4'}                   | ${'3::4'}
  ${'0000::1'}                                 | ${'::1'}
  ${'f::0000'}                                 | ${'f::'}
  ${'aa:bb:0::cc:dd:ee:ff'}                    | ${'aa:bb::cc:dd:ee:ff'}
  ${'0:0:0:0:12:34:56::'}                      | ${'::12:34:56:0'}
  ${'::1:2:0:0:0:3'}                           | ${'0:0:1:2::3'}
  ${'0001:0002:0003:0004:0005:0006:0007:0008'} | ${'1:2:3:4:5:6:7:8'}
  ${'0034::0:0:00ab:cd'}                       | ${'34::ab:cd'}
  ${'ABCD::EF'}                                | ${'abcd::ef'}
  ${'[::abcd]'}                                | ${'::abcd'}
  ${'[::abc]'}                                 | ${'::abc'}
  ${'[::ab]'}                                  | ${'::ab'}
  ${'[::a]'}                                   | ${'::a'}
  ${'[1::1]'}                                  | ${'1::1'}
  ${'[1:2::12]'}                               | ${'1:2::12'}
  ${'[1:2:3::123]'}                            | ${'1:2:3::123'}
  ${'[1:2:3:4::1234]'}                         | ${'1:2:3:4::1234'}
  ${'[1:2:3:4:0005:6:7:8]'}                    | ${'1:2:3:4:5:6:7:8'}
  ${'[1234::]'}                                | ${'1234::'}
  ${'[12:ab::34:cd]'}                          | ${'12:ab::34:cd'}
  ${'::ffff:102:304'}                          | ${'::ffff:1.2.3.4'} // IPv4-in-v6 wrapped form
  ${'0:0::ffff:1.2.3.4'}                       | ${'::ffff:1.2.3.4'} // Same.
  `('returns `$expected` given `$addr`', ({ addr, expected }) => {
    expect(EndpointAddress[method](addr, false)).toBe(expected);
    expect(EndpointAddress[method](addr, true)).toBe(expected);
  });

  // Tests for "any" addresses. These should succeed if `allowAny === true` and
  // fail for `allowAny === false`.
  describe.each`
  allowAny
  ${true}
  ${false}
  `('with `allowAny === $allowAny`', ({ allowAny }) => {
    const verb = allowAny ? 'succeeds' : 'fails';
    test.each`
    addr                 | expected
    ${'::'}              | ${'::'}
    ${'[::]'}            | ${'::'}
    ${'0::'}             | ${'::'}
    ${'[0::]'}           | ${'::'}
    ${'0:0:0:0:0:0:0:0'} | ${'::'}
    ${'0::0'}            | ${'::'}
    ${'0000::'}          | ${'::'}
    ${'::0000'}          | ${'::'}
    ${'0.0.0.0'}         | ${'0.0.0.0'}
    ${'0.00.0.0'}        | ${'0.0.0.0'}
    ${'000.000.000.000'} | ${'0.0.0.0'}
    `(`${verb} for $addr`, ({ addr, expected }) => {
      if (allowAny) {
        const got = EndpointAddress[method](addr, true);
        expect(got).toBe(expected);
      } else if (throws) {
        expect(() => EndpointAddress[method](addr, false)).toThrow();
      } else {
        expect(EndpointAddress[method](addr, false)).toBeNull();
      }
    });
  });
});

describe('endpointString()', () => {
  test.each`
  address                                      | port     | expected
  ${'1234:5678:9abc:def0:0987:6543:210a:bcde'} | ${65432} | ${'[1234:5678:9abc:def0:0987:6543:210a:bcde]:65432'}
  ${'[1234::cdef]'}                            | ${23456} | ${'[1234::cdef]:23456'}
  ${'123.255.199.126'}                         | ${54321} | ${'123.255.199.126:54321'}
  ${'::ffff:123.255.199.126'}                  | ${12345} | ${'123.255.199.126:12345'}
  ${'::ffff:102:304'}                          | ${77}    | ${'[::ffff:102:304]:77'}
  ${'foo.bar'}                                 | ${12}    | ${'foo.bar:12'}
  ${'1234:5678:9abc:def0:0987:6543:210a:bcde'} | ${null}  | ${'[1234:5678:9abc:def0:0987:6543:210a:bcde]'}
  ${'123.255.199.126'}                         | ${null}  | ${'123.255.199.126'}
  ${'::ffff:123.255.199.126'}                  | ${null}  | ${'123.255.199.126'}
  ${'[::ffff:123.255.199.126]'}                | ${null}  | ${'123.255.199.126'}
  ${'::ffff:102:304'}                          | ${null}  | ${'[::ffff:102:304]'}
  ${'foo.bar'}                                 | ${null}  | ${'foo.bar'}
  ${null}                                      | ${0}     | ${'<unknown>:0'}
  ${null}                                      | ${1}     | ${'<unknown>:1'}
  ${null}                                      | ${10000} | ${'<unknown>:10000'}
  ${null}                                      | ${null}  | ${'<unknown>'}
  ${'::'}                                      | ${123}   | ${'[::]:123'}
  ${'::ffff:abcd'}                             | ${99}    | ${'[::ffff:abcd]:99'}
  ${'123::ffff:432'}                           | ${7777}  | ${'[123::ffff:432]:7777'}
  `('with ($address, $port)', ({ address, port, expected }) => {
    expect(EndpointAddress.endpointString(address, port)).toBe(expected);
  });
});
