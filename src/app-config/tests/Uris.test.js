// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Uris } from '@this/app-config';

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
    expect(() => Uris.checkAbsolutePath(path)).not.toThrow();
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
    expect(() => Uris.checkBasicUri(path)).not.toThrow();
  });
});

describe('checkInterface()', () => {
  const LONGEST_COMPONENT = 'x'.repeat(63);
  const LONGEST_NAME      = `${'florp.'.repeat(41)}vwxyz.com`;

  // Failure cases.
  test.each`
  label                                 | iface
  ${'null'}                             | ${null}
  ${'non-string'}                       | ${123}
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
  `('fails for $label', ({ iface }) => {
    expect(() => Uris.checkInterface(iface)).toThrow();
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
  ${LONGEST_COMPONENT}
  ${`${LONGEST_COMPONENT}.boop`}
  ${`${LONGEST_COMPONENT}.${LONGEST_COMPONENT}`}
  ${LONGEST_NAME}
  `('succeeds for $iface', ({ iface }) => {
    expect(() => Uris.checkInterface(iface)).not.toThrow();
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
  ${'invalid hostname character'}      | ${'//foo.b$r/bar/'}
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
  `('succeeds for $mount', ({ mount }) => {
    expect(() => Uris.checkMount(mount)).not.toThrow();
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
  });

  test('works for maximum valid value (65535)', () => {
    expect(Uris.checkPort(65535, false)).toBe(65535);
    expect(Uris.checkPort(65535, true)).toBe(65535);
  });

  test('works for all valid port numbers (non-exhaustive)', () => {
    for (let p = 2; p <= 65534; p += 1235) {
      expect(Uris.checkPort(p, false)).toBe(p);
      expect(Uris.checkPort(p, true)).toBe(p);
    }
  });

  // Failure cases.
  test.each`
  label                                | port
  ${'null'}                            | ${null}
  ${'non-`*` string'}                  | ${'123'}
  ${'bigint'}                          | ${123n}
  ${'non-integer'}                     | ${12.34}
  ${'0'}                               | ${0}
  ${'-1'}                              | ${-1}
  ${'65536'}                           | ${65536}
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

describe('parseHostname()', () => {
  // TODO:
});
/**
 * Parses a possibly-wildcarded hostname into a {@link TreePathKey}.
 *
 * **Note:** Because hostname hierarchy is from right-to-left (e.g., wildcards
 * are at the front of a hostname not the back), the `.path` of the result
 * contains the name components in back-to-front order.
 *
 * @param {string} name Hostname to parse.
 * @param {boolean} [allowWildcards = false] Is a wildcard form allowed for
 *   `name`?
 * @returns {TreePathKey} Parsed key.
 * @throws {Error} Thrown if `name` is invalid.
 */
//static parseHostname(name, allowWildcards = false) {

describe('parseMount()', () => {
  // TODO:
});
/**
 * Parses a mount point into its two components.
 *
 * @param {string} mount Mount point.
 * @returns {{hostname: TreePathKey, path: TreePathKey}} Components thereof.
 */
//static parseMount(mount) {
