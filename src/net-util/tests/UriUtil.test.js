// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { UriUtil } from '@this/net-util';


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
    expect(() => UriUtil.checkBasicUri(path)).toThrow();
  });

  // Success cases.
  test.each`
  path
  ${'http://foo/'}
  ${'http://foo.bar/'}
  ${'https://foo.bar/baz/'}
  ${'https://foo.bar/b%20az/'}
  `('succeeds for $path', ({ path }) => {
    expect(UriUtil.checkBasicUri(path)).toBe(path);
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
      const result = UriUtil.pathStringFrom(key, ...relArg);

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

describe('isPathComponent()', () => {
  // Failure cases: Bad arguments
  test.each`
  value
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${['x']}
  ${{ a: 'x' }}
  ${new Map()}
  `('throws given $value', ({ value }) => {
    expect(() => UriUtil.isPathComponent(value)).toThrow();
  });

  // `false` cases.
  test.each`
  label                               | value
  ${'path navigation'}                | ${'.'}
  ${'path navigation'}                | ${'..'}
  ${'space'}                          | ${'bip bop'}
  ${'slash'}                          | ${'x/y'}
  ${'query'}                          | ${'foo?query'}
  ${'fragment'}                       | ${'bar#fragment'}
  ${'invalid %-encoding'}             | ${'foo%%bar'}
  ${'invalid %-encoding'}             | ${'foo%XYbar'}
  ${'invalid %-encoding (lowercase)'} | ${'foo%aabar'}
  ${'incomplete %-encoding'}          | ${'foo%'}
  ${'incomplete %-encoding'}          | ${'foo%1'}
  ${'non-ASCII'}                      | ${'\u{a1}'}
  ${'non-ASCII'}                      | ${'\u{1a1}'}
  ${'non-ASCII'}                      | ${'\u{1a10}'}
  `('returns `false` for `$value` ($label)', ({ value }) => {
    expect(UriUtil.isPathComponent(value)).toBeFalse();
  });

  test('returns `false` for all ASCII control characters', () => {
    for (let n = 0; n <= 31; n++) {
      const ch = String.fromCodePoint(n);
      expect(UriUtil.isPathComponent(`x${ch}y`)).toBeFalse();
    }
  });

  test('returns `false` for all disallowed ASCII printables', () => {
    for (let n = 32; n <= 127; n++) {
      const ch = String.fromCodePoint(n);
      if (!/[-_.~!$&'()*+,;=:@%A-Za-z0-9]/.test(ch)) {
        expect(UriUtil.isPathComponent(`x${ch}y`)).toBeFalse();
      }
    }
  });

  // `true` cases.
  test.each`
  value
  ${''}
  ${'a'}
  ${'abcdefghijklmnopqrstuvwxyz'}
  ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}
  ${'0123456789'}
  ${"-._~!$&'()*+,;=:@"}
  ${'...'}
  ${'.florp'}
  ${'foo.'}
  ${'zonk..'}
  ${'x.y'}
  ${'x..y'}
  ${'%01'}
  ${'%AB'}
  ${'%23%45'}
  ${'x%67%89y'}
  ${'-%AB-%CD-%EF-'}
  ${'%F0...%9C'}
  `('returns `true` for `$value`', ({ value }) => {
    expect(UriUtil.isPathComponent(value)).toBeTrue();
  });
});
