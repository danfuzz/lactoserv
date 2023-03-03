// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Uris } from '@this/app-config';
import { TreePathKey } from '@this/collections';


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
  label                                 | iface
  ${'null'}                             | ${null}
  ${'non-string'}                       | ${123}
  ${'empty string'}                     | ${''}
  ${'too-long DNS component'}           | ${`z${LONGEST_COMPONENT}`}
  ${'too-long DNS name'}                | ${`z${LONGEST_NAME}`}
  ${'first component starts with `-`'}  | ${'-foo.bar'}
  ${'first component ends with `-`'}    | ${'foo-.bar'}
  ${'middle component starts with `-`'} | ${'foo.-x.bar'}
  ${'middle component ends with `-`'}   | ${'foo.x-.bar'}
  ${'final component starts with `-`'}  | ${'foo.-bar'}
  ${'final component ends with `-`'}    | ${'foo.bar-'}
  ${'invalid DNS character'}            | ${'foo!bar.baz'}
  ${'canonical IPv6 wildcard'}          | ${'::'}
  ${'IPv6 wildcard'}                    | ${'0::'}
  ${'too many IPv6 double colons'}      | ${'123::45::67'}
  ${'IPv6 triple colon'}                | ${'123:::45:67'}
  ${'too few IPv6 colons'}              | ${'123:45:67:89:ab'}
  ${'invalid IPv6 digit'}               | ${'123::g:456'}
  ${'too-long IPv6 component'}          | ${'123::45678:9'}
  ${'too many IPv6 components'}         | ${'1:2:3:4:5:6:7:8:9'}
  ${'canonical IPv4 wildcard'}          | ${'0.0.0.0'}
  ${'IPv4 wildcard'}                    | ${'0.00.0.0'}
  ${'too-long IPv4 component'}          | ${'10.0.0.0099'}
  ${'too-large IPv4 component'}         | ${'10.256.0.1'}
  ${'IPv4 in brackets'}                 | ${'[1.2.3.4]'}
  ${'IPv4 with extra char at start'}    | ${'@1.2.3.45'}
  ${'IPv4 with extra char at end'}      | ${'1.2.3.45#'}
  ${'IPv4 with extra dot at start'}     | ${'.12.2.3.45'}
  ${'IPv4 with extra dot at end'}       | ${'14.25.37.24.'}
  ${'DNS name in brackets'}             | ${'[foo.bar]'}
  ${'IPv6 missing open bracket'}        | ${'1:2:3::4]'}
  ${'IPv6 missing close bracket'}       | ${'[aa:bc::d:e:f'}
  ${'IPv6 with extra at start'}         | ${'xaa:bc::1:2:34'}
  ${'IPv6 with extra at end'}           | ${'aa:bc::1:2:34z'}
  `('fails for $label', ({ iface }) => {
    expect(() => Uris.checkInterfaceAddress(iface)).toThrow();
  });

  // Success cases.
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
  ${'0123:4567:89ab:cdef:0123:4567:89ab:cdef'}
  ${'0123:4567:89ab::0123:4567:89ab:cdef'}
  ${'0123:4567::0123:4567:89ab:cdef'}
  ${'0123:4567::4567:89ab:cdef'}
  ${'0123::4567:89ab:cdef'}
  ${'0123::4567:89ab'}
  ${'0123::4567'}
  ${'ABCD::EF'}
  ${'::abcd'}
  ${'[::abcd]'}
  ${'[::abc]'}
  ${'[::ab]'}
  ${'[::a]'}
  ${'[1::1]'}
  ${'[1:2::12]'}
  ${'[1:2:3::123]'}
  ${'[1:2:3:4::1234]'}
  ${'[1:2:3:4:5:6:7:8]'}
  ${'[1234::]'}
  ${'[12:ab::34:cd]'}
  ${LONGEST_COMPONENT}
  ${`${LONGEST_COMPONENT}.boop`}
  ${`${LONGEST_COMPONENT}.${LONGEST_COMPONENT}`}
  ${LONGEST_NAME}
  `('succeeds for $iface', ({ iface }) => {
    const got      = Uris.checkInterfaceAddress(iface);
    const expected = iface.replace(/\[|\]/g, '');
    expect(got).toBe(expected);
  });
});

describe('checkMount()', () => {
  // Failure cases.
  test.each`
  label                                | mount
  ${'null'}                            | ${null}
  ${'non-string'}                      | ${123}
  ${'no slash at start'}               | ${'foo/bar/'}
  ${'single slash at start'}           | ${'/foo/bar/'}
  ${'triple slash at start'}           | ${'///foo/bar/'}
  ${'no slash at end'}                 | ${'//foo/bar'}
  ${'double slash at end'}             | ${'//foo/bar//'}
  ${'triple slash at end'}             | ${'//foo/bar///'}
  ${'double slash in middle'}          | ${'//foo//bar/'}
  ${'triple slash in middle'}          | ${'//foo///bar/'}
  ${'double slash at end'}             | ${'/foo/bar//'}
  ${'`.` component'}                   | ${'//foo/./bar/'}
  ${'`..` component'}                  | ${'//foo/../bar/'}
  ${'`-` component'}                   | ${'//foo/-/bar/'}
  ${'`-` at start of component'}       | ${'//foo/-bar/'}
  ${'`-` at end of component'}         | ${'//foo/bar-/'}
  ${'invalid component character'}     | ${'//foo/b@r/'}
  ${'`-` at hostname component start'} | ${'//foo.-foo/bar/'}
  ${'`-` at hostname component end'}   | ${'//foo.foo-/bar/'}
  ${'hostname wildcard in middle'}     | ${'//foo.*.bar/'}
  ${'hostname wildcard at end'}        | ${'//foo.*/'}
  ${'hostname wildcard without dot'}   | ${'//*foo/'}
  ${'invalid hostname character'}      | ${'//foo.b$r/bar/'}
  ${'hostname component too long'}     | ${`//z${LONGEST_COMPONENT}/`}
  ${'hostname too long'}               | ${`//z${LONGEST_NAME}/`}
  `('fails for $label', ({ mount }) => {
    expect(() => Uris.checkMount(mount)).toThrow();
  });

  // Success cases.
  test.each`
  mount
  ${'//foo/'}
  ${'//foo/bar/'}
  ${'//foo/bar/baz/'}
  ${'//*/'}
  ${'//*/florp/'}
  ${'//*.foo/florp/'}
  ${'//*.foo.bar/florp/'}
  ${'//foo.bar/'}
  ${'//foo.bar/florp/'}
  ${'//foo/.florp/'}
  ${'//foo/florp./'}
  ${'//foo/_florp/'}
  ${'//foo/florp_/'}
  ${'//foo/florp-like/'}
  ${'//foo/.../'} // Weird, but should be allowed.
  ${`//${LONGEST_COMPONENT}/`}
  ${`//${LONGEST_COMPONENT}.${LONGEST_COMPONENT}/`}
  ${`//${LONGEST_NAME}/`}
  ${`//${LONGEST_NAME}/a/`}
  ${`//${LONGEST_NAME}/abcde/fghij/`}
  `('succeeds for $mount', ({ mount }) => {
    expect(Uris.checkMount(mount)).toBe(mount);
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
method                   | throws
${'parseHostname'}       | ${true}
${'parseHostnameOrNull'} | ${false}
`('$method()', ({ method, throws }) => {
  // Non-string failures. These are supposed to throw even with `*OrNull()`.
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
    const expectWildcard = hostname.startsWith('*');
    const expectLength   = hostname.replace(/[^.]/g, '').length + Number(!expectWildcard);

    expect(got.wildcard).toBe(expectWildcard);
    expect(got.length).toBe(expectLength);
    expect(TreePathKey.hostnameStringFrom(got)).toBe(hostname);
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
  ${LONGEST_COMPONENT}
  ${`${LONGEST_COMPONENT}.${LONGEST_COMPONENT}`}
  ${LONGEST_NAME}
  `('succeeds for $hostname', ({ hostname }) => {
    checkAnswer(hostname, Uris.parseHostname(hostname, false));
    checkAnswer(hostname, Uris.parseHostname(hostname, true));
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

    checkAnswer(hostname, Uris.parseHostname(hostname, true));
  });
});

describe('parseMount()', () => {
  // Note: Other tests in this file check a lot of the code that's used by this
  // method, so it's not really necessary to be super-exhaustive here.

  // Failure cases.
  test.each`
  label                                | mount
  ${'null'}                            | ${null}
  ${'non-string'}                      | ${123}
  ${'no slash at start'}               | ${'foo/bar/'}
  ${'invalid component character'}     | ${'//foo/b@r/'}
  ${'invalid hostname'}                | ${'//.foo./bar/'}
  `('fails for $label', ({ mount }) => {
    expect(() => Uris.parseMount(mount)).toThrow();
  });

  // "Smokey" success tests.

  test('parses a mount with non-wildcard host as expected', () => {
    const expectHost = new TreePathKey(['bar', 'foo'], false);
    const expectPath = new TreePathKey(['a', 'b', 'c'], true);
    const got        = Uris.parseMount('//foo.bar/a/b/c/');

    expect(got.hostname.equals(expectHost)).toBeTrue();
    expect(got.path.equals(expectPath)).toBeTrue();
  });

  test('parses a mount with partial wildcard host as expected', () => {
    const expectHost = new TreePathKey(['zorp', 'beep'], true);
    const expectPath = new TreePathKey(['blortch'], true);
    const got        = Uris.parseMount('//*.beep.zorp/blortch/');

    expect(got.hostname.equals(expectHost)).toBeTrue();
    expect(got.path.equals(expectPath)).toBeTrue();
  });

  test('parses a mount with full wildcard host as expected', () => {
    const expectHost = new TreePathKey([], true);
    const expectPath = new TreePathKey(['xyz', 'abc', '123', 'zzz'], true);
    const got        = Uris.parseMount('//*/xyz/abc/123/zzz/');

    expect(got.hostname.equals(expectHost)).toBeTrue();
    expect(got.path.equals(expectPath)).toBeTrue();
  });
});
