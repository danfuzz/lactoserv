// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { Names } from '@this/compy';

describe.each`
methodName      | throws
${'checkName'}  | ${true}
${'isName'}     | ${false}
`('$methodName()', ({ methodName, throws }) => {
  // Non-string errors. Always expected to throw.
  test.each`
  arg
  ${null}
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${['x']}
  ${{ a: 'x' }}
  `('throws given $arg', ({ arg }) => {
    expect(() => Names[methodName](arg)).toThrow();
  });

  // Invalid strings.
  test.each`
  arg
  ${''}
  ${'#'}    // Invalid character at start.
  ${'x^'}   // ...at end.
  ${'x&y'}  // ...in the middle.
  ${'.xyz'} // Can't start with a dot.
  ${'abc.'} // ...or end with one.
  ${'-xyz'} // Can't start with a dash.
  ${'abc-'} // ...or end with one.
  `('rejects `$arg`', ({ arg }) => {
    if (throws) {
      expect(() => Names[methodName](arg)).toThrow();
    } else {
      expect(Names[methodName](arg)).toBeFalse();
    }
  });

  // Valid strings.
  test.each`
  arg
  ${'a'}
  ${'A'}
  ${'0'}
  ${'_'}
  ${'_abc'}
  ${'abc_'}
  ${'_abc_'}
  ${'abc_def'}
  ${'a-b'}
  ${'a.b'}
  ${'foo-bar.baz_biff'}
  `('accepts `$arg`', ({ arg }) => {
    if (throws) {
      expect(() => Names[methodName](arg)).not.toThrow();
    }

    const got = Names[methodName](arg);
    if (throws) {
      expect(got).toBe(arg);
    } else {
      expect(got).toBeTrue();
    }
  });
});

describe('parsePath()', () => {
  const wildKey    = new PathKey(['a', 'b', 'c'], true);
  const nonWildKey = new PathKey(['cd', 'ef'], false);

  function nonWildcardCases(allowWildcard) {
    test.each`
    arg             | expected
    ${'/'}          | ${[]}
    ${'/a'}         | ${['a']}
    ${'/a/b'}       | ${['a', 'b']}
    ${'/a/b/c'}     | ${['a', 'b', 'c']}
    ${'/boop/beep'} | ${['boop', 'beep']}
    ${[]}           | ${[]}
    ${['zz']}       | ${['zz']}
    ${['zz', 'yy']} | ${['zz', 'yy']}
    ${nonWildKey}   | ${['cd', 'ef']}
    `('works given $arg', ({ arg, expected }) => {
      const args = (allowWildcard === null)
        ? [arg]
        : [arg, allowWildcard];
      const got = Names.parsePath(...args);
      expect(got.wildcard).toBeFalse();
      expect(got.path).toEqual(expected);
    });
  }

  function wildcardCases(allowWildcard) {
    const msg = allowWildcard
      ? 'works given $arg'
      : 'throws given $arg';
    test.each`
    arg                  | expected
    ${'/*'}              | ${[]}
    ${'/a/*'}            | ${['a']}
    ${'/a/b/*'}          | ${['a', 'b']}
    ${'/a/b/c/*'}        | ${['a', 'b', 'c']}
    ${'/boop/beep/*'}    | ${['boop', 'beep']}
    ${['*']}             | ${[]}
    ${['bop', '*']}      | ${['bop']}
    ${['bop', 'z', '*']} | ${['bop', 'z']}
    ${wildKey}           | ${['a', 'b', 'c']}
    `(msg, ({ arg, expected }) => {
      if (allowWildcard) {
        const got = Names.parsePath(arg, true);
        expect(got.wildcard).toBeTrue();
        expect(got.path).toEqual(expected);
      } else if (allowWildcard === null) {
        expect(() => Names.parsePath(arg)).toThrow();
      } else {
        expect(() => Names.parsePath(arg, false)).toThrow();
      }
    });
  }

  describe('with default `allowWildcard` (of `false`)', () => {
    nonWildcardCases(null);
    wildcardCases(null);

    // TODO: error cases.
  });

  describe('with `allowWildcard === false`', () => {
    nonWildcardCases(false);
    wildcardCases(false);

    // TODO: error cases.
  });

  describe('with `allowWildcard === true`', () => {
    nonWildcardCases(true);
    wildcardCases(true);

    // TODO: error cases.
  });
});
