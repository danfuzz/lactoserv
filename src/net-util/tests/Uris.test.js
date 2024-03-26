// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { Uris } from '@this/net-util';


const LONGEST_COMPONENT = 'x'.repeat(63);
const LONGEST_NAME      = `${'florp.'.repeat(41)}vwxyz.com`;

describe('checkAbsolutePath()', () => {
  // Failure cases.
  test.each`
  label                               | path
  ${'null'}                           | ${null}
  ${'non-string'}                     | ${123}
  ${'no slash at start'}              | ${'foo/bar/'}
  ${'no slash at end'}                | ${'/foo/bar'}
  ${'double slash at start'}          | ${'//foo/bar/'}
  ${'double slash in middle'}         | ${'/foo//bar/'}
  ${'double slash at end'}            | ${'/foo/bar//'}
  ${'triple slash'}                   | ${'/foo///bar/'}
  ${'`.` component'}                  | ${'/foo/./bar/'}
  ${'`..` component'}                 | ${'/foo/../bar/'}
  ${'query'}                          | ${'/foo?x=123/'}
  ${'hash fragment'}                  | ${'/foo#123/'}
  ${'character needing `%`-encoding'} | ${'/foo/b ar/'}
  `('fails for $label', ({ path }) => {
    expect(() => Uris.checkAbsolutePath(path)).toThrow();
  });

  // Success cases.
  test.each`
  path
  ${'/'}
  ${'/foo/'}
  ${'/foo/bar/'}
  ${'/foo/b%20ar/'}
  `('succeeds for $path', ({ path }) => {
    expect(Uris.checkAbsolutePath(path)).toBe(path);
  });
});

describe('checkBasicUri()', () => {
  // Failure cases.
  test.each`
  label                               | path
  ${'null'}                           | ${null}
  ${'non-string'}                     | ${123}
  ${'disallowed protocol'}            | ${'ftp://foo/bar/'}
  ${'no slash at start'}              | ${'https:foo/bar/'}
  ${'single slash at start'}          | ${'https:/foo/bar/'}
  ${'triple slash at start'}          | ${'https:///foo/bar/'}
  ${'no slash at end'}                | ${'https://foo/bar'}
  ${'double slash in middle'}         | ${'https://foo//bar/'}
  ${'double slash at end'}            | ${'https://foo/bar//'}
  ${'triple slash in middle'}         | ${'https://foo///bar/'}
  ${'`.` component'}                  | ${'http://foo/./bar/'}
  ${'`..` component'}                 | ${'http://foo/../bar/'}
  ${'query'}                          | ${'http://foo/bar?x=123/'}
  ${'hash fragment'}                  | ${'http://foo/bar#123/'}
  ${'character needing `%`-encoding'} | ${'http://foo/b ar/'}
  ${'username'}                       | ${'https://user@foo/bar/'}
  ${'username and password'}          | ${'https://user:pass@foo/bar/'}
  ${'invalid hostname'}               | ${'https://foo .bar/'}
  `('fails for $label', ({ path }) => {
    expect(() => Uris.checkBasicUri(path)).toThrow();
  });

  // Success cases.
  test.each`
  path
  ${'http://foo/'}
  ${'http://foo.bar/'}
  ${'https://foo.bar/baz/'}
  ${'https://foo.bar/b%20az/'}
  `('succeeds for $path', ({ path }) => {
    expect(Uris.checkBasicUri(path)).toBe(path);
  });
});

describe('checkInterfaceAddress()', () => {
  // Failure cases.
  test.each`
  label                                    | iface
  ${'null'}                                | ${null}
  ${'non-string'}                          | ${123}
  ${'empty string'}                        | ${''}
  ${'too-long DNS component'}              | ${`z${LONGEST_COMPONENT}`}
  ${'too-long DNS name'}                   | ${`z${LONGEST_NAME}`}
  ${'first component starts with `-`'}     | ${'-foo.bar'}
  ${'first component ends with `-`'}       | ${'foo-.bar'}
  ${'middle component starts with `-`'}    | ${'foo.-x.bar'}
  ${'middle component ends with `-`'}      | ${'foo.x-.bar'}
  ${'final component starts with `-`'}     | ${'foo.-bar'}
  ${'final component ends with `-`'}       | ${'foo.bar-'}
  ${'invalid DNS character'}               | ${'foo!bar.baz'}
  ${'canonical IPv6 wildcard'}             | ${'::'}
  ${'canonical IPv6 wildcard in brackets'} | ${'[::]'}
  ${'IPv6 wildcard'}                       | ${'0::'}
  ${'IPv6 wildcard in brackets'}           | ${'[0::]'}
  ${'too many IPv6 double colons'}         | ${'123::45::67'}
  ${'IPv6 triple colon'}                   | ${'123:::45:67'}
  ${'too few IPv6 colons'}                 | ${'123:45:67:89:ab'}
  ${'invalid IPv6 digit'}                  | ${'123::g:456'}
  ${'too-long IPv6 component'}             | ${'123::45678:9'}
  ${'too many IPv6 components'}            | ${'1:2:3:4:5:6:7:8:9'}
  ${'too many IPv6 components with `::`'}  | ${'1:2:3:4:5::6:7:8:9'}
  ${'canonical IPv4 wildcard'}             | ${'0.0.0.0'}
  ${'IPv4 wildcard'}                       | ${'0.00.0.0'}
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
  `('fails for $label', ({ iface }) => {
    expect(() => Uris.checkInterfaceAddress(iface)).toThrow();
  });

  // Success cases that are given in canonical form.
  test.each`
  iface
  ${'*'}
  ${'foo'}
  ${'foo.bar'}
  ${'foo.bar.baz'}
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
  ${'::abcd'}
  ${LONGEST_COMPONENT}
  ${`${LONGEST_COMPONENT}.boop`}
  ${`${LONGEST_COMPONENT}.${LONGEST_COMPONENT}`}
  ${LONGEST_NAME}
  `('succeeds for $iface', ({ iface }) => {
    const got      = Uris.checkInterfaceAddress(iface);
    const expected = iface.replace(/\[|\]/g, '');
    expect(got).toBe(expected);
  });

  // Success cases that are given in non-canonical form.
  test.each`
  iface                   | expected
  ${'0:0:0:0:12:34:56::'} | ${'::12:34:56:0'}
  ${'02:003:0004::'}      | ${'2:3:4::'}
  ${'ABCD::EF'}           | ${'abcd::ef'}
  ${'[0123::]'}           | ${'123::'}
  ${'[::abcd]'}           | ${'::abcd'}
  ${'[1::1]'}             | ${'1::1'}
  ${'[1:2:3:4:5:6:7:8]'}  | ${'1:2:3:4:5:6:7:8'}
  ${'[12:Ab::34:cD]'}     | ${'12:ab::34:cd'}
  `('succeeds for $iface', ({ iface, expected }) => {
    const got = Uris.checkInterfaceAddress(iface);
    expect(got).toBe(expected);
  });
});

describe.each`
method                    | throws
${'checkIpAddress'}       | ${true}
${'checkIpAddressOrNull'} | ${false}
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
    expect(() => Uris[method](addr, false)).toThrow();
    expect(() => Uris[method](addr, true)).toThrow();
  });

  // Failure cases.
  test.each`
  label                                    | addr
  ${'empty string'}                        | ${''}
  ${'complete wildcard'}                   | ${'*'}
  ${'wildcard IPv4-ish address'}           | ${'*.2.3.4'}
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
  `('fails for $label', ({ addr }) => {
    if (throws) {
      expect(() => Uris[method](addr, false)).toThrow();
      expect(() => Uris[method](addr, true)).toThrow();
    } else {
      expect(Uris[method](addr, false)).toBeNull();
      expect(Uris[method](addr, true)).toBeNull();
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
  `('succeeds for $addr', ({ addr }) => {
    expect(Uris[method](addr, false)).toBe(addr);
    expect(Uris[method](addr, true)).toBe(addr);
  });

  // Success cases that are given in non-canonical form.
  test.each`
  addr                                         | expected
  ${'010.0.0.1'}                               | ${'10.0.0.1'}
  ${'10.02.0.1'}                               | ${'10.2.0.1'}
  ${'10.0.004.1'}                              | ${'10.0.4.1'}
  ${'123.0.0.09'}                              | ${'123.0.0.9'}
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
  `('succeeds for $addr', ({ addr, expected }) => {
    expect(Uris[method](addr, false)).toBe(expected);
    expect(Uris[method](addr, true)).toBe(expected);
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
        const got = Uris[method](addr, true);
        expect(got).toBe(expected);
      } else if (throws) {
        expect(() => Uris[method](addr, false)).toThrow();
      } else {
        expect(Uris[method](addr, false)).toBeNull();
      }
    });
  });
});

describe('checkPort()', () => {
  test('works for `*` when `allowWildcard === true`', () => {
    expect(Uris.checkPort('*', true)).toBe(0);
  });

  test('fails for `*` when `allowWildcard === false`', () => {
    expect(() => Uris.checkPort('*', false)).toThrow();
  });

  test('works for minimum valid value (1)', () => {
    expect(Uris.checkPort(1, false)).toBe(1);
    expect(Uris.checkPort(1, true)).toBe(1);
    expect(Uris.checkPort('1', false)).toBe(1);
    expect(Uris.checkPort('1', true)).toBe(1);
  });

  test('works for maximum valid value (65535)', () => {
    expect(Uris.checkPort(65535, false)).toBe(65535);
    expect(Uris.checkPort(65535, true)).toBe(65535);
    expect(Uris.checkPort('65535', false)).toBe(65535);
    expect(Uris.checkPort('65535', true)).toBe(65535);
  });

  test('works for all valid port numbers (non-exhaustive)', () => {
    for (let p = 2; p <= 65534; p += 1235) {
      expect(Uris.checkPort(p, false)).toBe(p);
      expect(Uris.checkPort(p, true)).toBe(p);
    }
  });

  test('works for all valid port numbers as strings (non-exhaustive)', () => {
    for (let p = 2; p <= 65534; p += 1111) {
      expect(Uris.checkPort(`${p}`, false)).toBe(p);
      expect(Uris.checkPort(`${p}`, true)).toBe(p);
    }
  });

  // Failure cases.
  test.each`
  label                                     | port
  ${'null'}                                 | ${null}
  ${'empty string'}                         | ${''}
  ${'non-`*` non-digit string'}             | ${'abc'}
  ${'non-digit string starting with digit'} | ${'123abc'}
  ${'bigint'}                               | ${123n}
  ${'non-integer'}                          | ${12.34}
  ${'0'}                                    | ${0}
  ${'-1'}                                   | ${-1}
  ${'65536'}                                | ${65536}
  `('fails for $label', ({ port }) => {
    expect(() => Uris.checkPort(port)).toThrow();
  });
});

describe('checkProtocol()', () => {
  // Failure cases.
  test.each`
  label                 | protocol
  ${'null'}             | ${null}
  ${'non-string'}       | ${123}
  ${'invalid protocol'} | ${'ftp'}
  `('fails for $label', ({ protocol }) => {
    expect(() => Uris.checkProtocol(protocol)).toThrow();
  });

  // Success cases.
  test.each`
  protocol
  ${'http'}
  ${'https'}
  ${'http2'}
  `('succeeds for $protocol', ({ protocol }) => {
    expect(Uris.checkProtocol(protocol)).toBe(protocol);
  });
});

describe.each`
method                   | throws   | returns
${'checkHostname'}       | ${true}  | ${'string'}
${'checkHostnameOrNull'} | ${false} | ${'string'}
${'parseHostname'}       | ${true}  | ${'path'}
${'parseHostnameOrNull'} | ${false} | ${'path'}
`('$method()', ({ method, throws, returns }) => {
  // Failures from passing non-strings. These are always supposed to throw.
  test.each`
  hostname
  ${null}
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${Symbol('boop')}
  ${['a', 'b']}
  ${{ a: 'florp' }}
  `('throws for $hostname', ({ hostname }) => {
    expect(() => Uris[method](hostname, false)).toThrow();
    expect(() => Uris[method](hostname, true)).toThrow();
  });

  // Failure cases.
  test.each`
  label                       | hostname
  ${'empty string'}           | ${''}
  ${'`-` at component start'} | ${'foo.-foo'}
  ${'`-` at component end'}   | ${'foo-.foo'}
  ${'wildcard in middle'}     | ${'foo.*.bar'}
  ${'wildcard at end'}        | ${'foo.*'}
  ${'wildcard without dot'}   | ${'*foo'}
  ${'invalid character `$`'}  | ${'foo.b$r'}
  ${'invalid character `_`'}  | ${'foo.b_r'}
  ${'double dot'}             | ${'foo..bar'}
  ${'dot at start'}           | ${'.foo.bar'}
  ${'dot at end'}             | ${'foo.bar.'}
  ${'component too long'}     | ${`m${LONGEST_COMPONENT}`}
  ${'name too long'}          | ${`m${LONGEST_NAME}`}
  ${'IPv4 "any" address'}     | ${'0.0.0.0'}
  ${'IPv6 "any" address'}     | ${'::'}
  `('fails for $label', ({ hostname }) => {
    if (throws) {
      expect(() => Uris[method](hostname, false)).toThrow();
      expect(() => Uris[method](hostname, true)).toThrow();
    } else {
      expect(Uris[method](hostname, false)).toBeNull();
      expect(Uris[method](hostname, true)).toBeNull();
    }
  });

  const checkAnswer = (hostname, got) => {
    const canonicalIp = Uris.checkIpAddressOrNull(hostname, false);
    if (returns === 'string') {
      if (canonicalIp) {
        // Expect IP addresses to be canonicalized.
        expect(got).toBe(canonicalIp);
      } else {
        expect(got).toBe(hostname);
      }
    } else if (canonicalIp) {
      expect(got.wildcard).toBeFalse();
      expect(got.length).toBe(1);
      expect(got.path[0]).toBe(canonicalIp);
    } else {
      const expectWildcard = hostname.startsWith('*');
      const expectLength   = hostname.replace(/[^.]/g, '').length + Number(!expectWildcard);

      expect(got.wildcard).toBe(expectWildcard);
      expect(got.length).toBe(expectLength);
      expect(got.toHostnameString()).toBe(hostname);
    }
  };

  // Non-wildcard success cases.
  test.each`
  hostname
  ${'a'}
  ${'ab'}
  ${'abc'}
  ${'a.boop'}
  ${'ab.boop'}
  ${'abc.boop'}
  ${'floop.a'}
  ${'floop.ab'}
  ${'floop.abc'}
  ${'a.b.c'}
  ${'foo.bar.baz.biff'}
  ${'123.bar'}
  ${'foo.0123456789.bar'}
  ${'ABC.DEF.GHI.JKL.MNO.PQR.STU.VWX.YZ'}
  ${'abcde.fghij.klmno.pqrst.uvwxyz'}
  ${'foo-bar.biff-baz'}
  ${'127.0.0.1'}
  ${'::1'}
  ${'[::1]'}
  ${LONGEST_COMPONENT}
  ${`${LONGEST_COMPONENT}.${LONGEST_COMPONENT}`}
  ${LONGEST_NAME}
  `('succeeds for $hostname', ({ hostname }) => {
    checkAnswer(hostname, Uris[method](hostname, false));
    checkAnswer(hostname, Uris[method](hostname, true));
  });

  // Wildcard success cases.
  test.each`
  hostname
  ${'*'}
  ${'*.a'}
  ${'*.foo.bar'}
  ${'*.beep.boop.blork'}
  `('succeeds for $hostname only when `allowWildcard === true`', ({ hostname }) => {
    if (throws) {
      expect(() => Uris[method](hostname, false)).toThrow();
    } else {
      expect(Uris[method](hostname, false)).toBeNull();
    }

    checkAnswer(hostname, Uris[method](hostname, true));
  });
});

describe('parseInterface()', () => {
  // Note: Other tests in this file check a lot of the code that's used by this
  // method, so it's not really necessary to be super-exhaustive here.

  // Failure cases.
  test.each`
  label                                 | mount
  ${'null'}                             | ${null}
  ${'non-string'}                       | ${123}
  ${'empty string'}                     | ${''}
  ${'just colon'}                       | ${':'}
  ${'missing address'}                  | ${':123'}
  ${'IPv4 with colon but missing port'} | ${'10.0.0.120:'}
  ${'IPv6 with colon but missing port'} | ${'[::1234]:'}
  ${'IPv4 missing colon and port'}      | ${'10.0.0.120'}
  ${'IPv6 missing colon and port'}      | ${'[ab::1234:45:123]'}
  ${'IPv4 port too large'}              | ${'192.168.0.33:65536'}
  ${'IPv4 port way too large'}          | ${'192.168.0.33:123456789'}
  ${'IPv6 port too large'}              | ${'[a:b::c:d]:65536'}
  ${'IPv6 port way too large'}          | ${'[0:123::4:56]:1023456789'}
  ${'IPv6 missing brackets'}            | ${'a:b:c::1234:8080'}
  ${'IPv6 "any" address'}               | ${'[::]:8080'}
  ${'IPv4 "any" address'}               | ${'[0.0.0.0]:8080'}
  ${'wildcard port `0`'}                | ${'12.34.5.66:0'}
  ${'wildcard port `*`'}                | ${'[12:34::5:66]:*'}
  ${'fd missing slash at start'}        | ${'dev/fd/3'}
  ${'fd with extra char at end'}        | ${'/dev/fd/123a'}
  ${'non-fd dev path'}                  | ${'/dev/florp'}
  ${'non-dev path'}                     | ${'/home/zorch/123'}
  ${'negative fd'}                      | ${'/dev/fd/-1'}
  ${'too-large fd'}                     | ${'/dev/fd/65536'}
  ${'much too-large fd'}                | ${'/dev/fd/999999999999999999999'}
  `('fails for $label', ({ mount }) => {
    expect(() => Uris.parseInterface(mount)).toThrow();
  });

  // "Smokey" success tests.

  test('parses an interface with IPv4 address as expected', () => {
    const got = Uris.parseInterface('12.34.56.78:123');
    expect(got).toStrictEqual({ address: '12.34.56.78', port: 123 });
  });

  test('parses an interface with IPv6 address as expected', () => {
    const got = Uris.parseInterface('[abc::123:4567]:999');
    expect(got).toStrictEqual({ address: 'abc::123:4567', port: 999 });
  });

  test('parses an interface with wildcard address as expected', () => {
    const got = Uris.parseInterface('*:17777');
    expect(got).toStrictEqual({ address: '*', port: 17777 });
  });

  test('parses an FD interface with no port as expected', () => {
    const got = Uris.parseInterface('/dev/fd/109');
    expect(got).toStrictEqual({ fd: 109 });
  });

  test('parses an FD interface with port as expected', () => {
    const got = Uris.parseInterface('/dev/fd/109:914');
    expect(got).toStrictEqual({ fd: 109, port: 914 });
  });

  test('accepts the minimum and maximum allowed FD numbers', () => {
    const got1 = Uris.parseInterface('/dev/fd/0');
    expect(got1).toStrictEqual({ fd: 0 });

    const got2 = Uris.parseInterface('/dev/fd/65535');
    expect(got2).toStrictEqual({ fd: 65535 });
  });
});

describe('pathStringFrom()', () => {
  describe.each`
  relArg     | label
  ${[]}      | ${'without `relative` passed (defaults to `false`)'}
  ${[false]} | ${'with `relative` passed as `false`'}
  ${[true]}  | ${'with `relative` passed as `true`'}
  `('$label', ({ relArg }) => {
    test.each`
    path                     | wildcard | expected
    ${[]}                    | ${false} | ${'/'}
    ${[]}                    | ${true}  | ${'/*'}
    ${['']}                  | ${false} | ${'/'}
    ${['']}                  | ${true}  | ${'//*'}
    ${['xyz']}               | ${false} | ${'/xyz'}
    ${['xyz']}               | ${true}  | ${'/xyz/*'}
    ${['a', '']}             | ${false} | ${'/a/'}
    ${['a', '']}             | ${true}  | ${'/a//*'}
    ${['a', '', 'bc']}       | ${false} | ${'/a//bc'}
    ${['a', '', 'bc']}       | ${true}  | ${'/a//bc/*'}
    ${['foo', 'bar', 'baz']} | ${false} | ${'/foo/bar/baz'}
    ${['foo', 'bar', 'baz']} | ${true}  | ${'/foo/bar/baz/*'}
    `('on { path: $path, wildcard: $wildcard }', ({ path, wildcard, expected }) => {
      const key    = new TreePathKey(path, wildcard);
      const result = Uris.pathStringFrom(key, ...relArg);

      if (relArg[0] === true) {
        // Expectation is special for `relative === true` on a non-wildcard
        // empty path.
        expected = ((key.length === 0) && !key.wildcard)
          ? '.'
          : `.${expected}`;
      }

      expect(result).toBe(expected);
    });
  });
});
