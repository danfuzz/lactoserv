// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { UriUtil } from '@this/net-util';


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
    expect(() => UriUtil.checkAbsolutePath(path)).toThrow();
  });

  // Success cases.
  test.each`
  path
  ${'/'}
  ${'/foo/'}
  ${'/foo/bar/'}
  ${'/foo/b%20ar/'}
  `('succeeds for $path', ({ path }) => {
    expect(UriUtil.checkAbsolutePath(path)).toBe(path);
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

describe('checkProtocol()', () => {
  // Failure cases.
  test.each`
  label                 | protocol
  ${'null'}             | ${null}
  ${'non-string'}       | ${123}
  ${'invalid protocol'} | ${'ftp'}
  `('fails for $label', ({ protocol }) => {
    expect(() => UriUtil.checkProtocol(protocol)).toThrow();
  });

  // Success cases.
  test.each`
  protocol
  ${'http'}
  ${'https'}
  ${'http2'}
  `('succeeds for $protocol', ({ protocol }) => {
    expect(UriUtil.checkProtocol(protocol)).toBe(protocol);
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
