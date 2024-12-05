// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { EndpointAddress, HostUtil } from '@this/net-util';


describe.each`
method                   | throws   | returns
${'checkHostname'}       | ${true}  | ${'string'}
${'checkHostnameOrNull'} | ${false} | ${'string'}
${'parseHostname'}       | ${true}  | ${'path'}
${'parseHostnameOrNull'} | ${false} | ${'path'}
`('$method()', ({ method, throws, returns }) => {
  const LONGEST_COMPONENT = 'x'.repeat(63);
  const LONGEST_NAME      = `${'florp.'.repeat(41)}vwxyz.com`;

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
    expect(() => HostUtil[method](hostname, false)).toThrow();
    expect(() => HostUtil[method](hostname, true)).toThrow();
  });

  // Failure cases.
  test.each`
  label                                | hostname
  ${'empty string'}                    | ${''}
  ${'`-` at component start'}          | ${'foo.-foo'}
  ${'`-` at component end'}            | ${'foo-.foo'}
  ${'wildcard in middle'}              | ${'foo.*.bar'}
  ${'wildcard at end'}                 | ${'foo.*'}
  ${'wildcard without dot'}            | ${'*foo'}
  ${'wildcard without dot'}            | ${'*foo.bar'}
  ${'wildcard in IPv4 address'}        | ${'*.123.4.5.6'}
  ${'wildcard in IPv4 address'}        | ${'*.1.234.5'}
  ${'wildcard in IPv4 address'}        | ${'*.12.34'}
  ${'wildcard in IPv4 address'}        | ${'*.100'}
  ${'wildcard in IPv6 address'}        | ${'*::'}
  ${'wildcard in IPv6 address'}        | ${'*::1234'}
  ${'wildcard in IPv6 address'}        | ${'*:a:b::c:d'}
  ${'invalid character `$`'}           | ${'foo.b$r'}
  ${'invalid character `_`'}           | ${'foo.b_r'}
  ${'double dot'}                      | ${'foo..bar'}
  ${'dot at start'}                    | ${'.foo.bar'}
  ${'dot at end'}                      | ${'foo.bar.'}
  ${'component too long'}              | ${`m${LONGEST_COMPONENT}`}
  ${'name too long'}                   | ${`m${LONGEST_NAME}`}
  ${'DNS name with a port'}            | ${'foo.bar:123'}
  ${'IPv4 address with a port'}        | ${'127.0.0.1:8443'}
  ${'IPv6 address with a port'}        | ${'[12::34]:80'}
  ${'IPv4 "any" address'}              | ${'0.0.0.0'}
  ${'IPv6 "any" address'}              | ${'::'}
  ${'too-short IPv4 address'}          | ${'123'}
  ${'too-short IPv4 address'}          | ${'1.234'}
  ${'too-short IPv4 address'}          | ${'1.23.45'}
  ${'too-short IPv6 address'}          | ${'1:2'}
  ${'too-short IPv6 address'}          | ${'1:2:3'}
  ${'too-short IPv6 address'}          | ${'1:2:3:4'}
  ${'too-short IPv6 address'}          | ${'1:2:3:4:5'}
  ${'too-short IPv6 address'}          | ${'1:2:3:4:5:6'}
  ${'too-short IPv6 address'}          | ${'1:2:3:4:5:6:7'}
  ${'too-long IPv6 address'}           | ${'1:2:3:4:5:6:7:8:9'}
  ${'too-long IPv6 address with `::`'} | ${'1:2:3:4:5::6:7:8'}
  `('fails for $label', ({ hostname }) => {
    if (throws) {
      expect(() => HostUtil[method](hostname, false)).toThrow();
      expect(() => HostUtil[method](hostname, true)).toThrow();
    } else {
      expect(HostUtil[method](hostname, false)).toBeNull();
      expect(HostUtil[method](hostname, true)).toBeNull();
    }
  });

  const checkAnswer = (hostname, got) => {
    expect(got).not.toBeNull();

    const canonicalIp = EndpointAddress.canonicalizeAddressOrNull(hostname, false);

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
      expect(HostUtil.hostnameStringFrom(got)).toBe(hostname);
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
    checkAnswer(hostname, HostUtil[method](hostname, false));
    checkAnswer(hostname, HostUtil[method](hostname, true));
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
      expect(() => HostUtil[method](hostname, false)).toThrow();
    } else {
      expect(HostUtil[method](hostname, false)).toBeNull();
    }

    checkAnswer(hostname, HostUtil[method](hostname, true));
  });
});

describe('hostnameStringFrom()', () => {
  test.each`
  path                     | wildcard | expected
  ${[]}                    | ${false} | ${''}
  ${[]}                    | ${true}  | ${'*'}
  ${['a']}                 | ${false} | ${'a'}
  ${['a']}                 | ${true}  | ${'*.a'}
  ${['foo', 'bar', 'baz']} | ${false} | ${'baz.bar.foo'}
  ${['foo', 'bar', 'baz']} | ${true}  | ${'*.baz.bar.foo'}
  `('on { path: $path, wildcard: $wildcard }', ({ path, wildcard, expected }) => {
    const key    = new PathKey(path, wildcard);
    const result = HostUtil.hostnameStringFrom(key);

    expect(result).toBe(expected);
  });
});
