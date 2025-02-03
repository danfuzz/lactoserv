// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { Names } from '@this/compy';


describe.each`
methodName      | throws
${'mustBeName'}  | ${true}
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

describe.each`
methodName                 | acceptsNull
${'parsePath'}             | ${false}
${'parsePossiblyNullPath'} | ${true}
`('$methodName()', ({ methodName, acceptsNull }) => {
  const wildKey    = new PathKey(['a', 'b', 'c'], true);
  const nonWildKey = new PathKey(['cd', 'ef'], false);

  const doCall = (arg, allowWildcard) => {
    const args = (allowWildcard === null)
      ? [arg]
      : [arg, allowWildcard];
    return Names[methodName](...args);
  };

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
      const got = doCall(arg, allowWildcard);
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
        const got = doCall(arg, true);
        expect(got.wildcard).toBeTrue();
        expect(got.path).toEqual(expected);
      } else {
        expect(() => doCall(arg, allowWildcard)).toThrow();
      }
    });
  }

  function errorCases(allowWildcard) {
    // Bad arguments which always throw.
    test.each`
    arg
    ${false}
    ${true}
    ${123}
    ${{ a: '/florp' }}
    ${''}           // Can't be empty.
    ${'florp'}      // Must start with a slash.
    ${'/foo/'}      // Must not end with a slash.
    ${'/foo//bar'}  // No empty components.
    ${'/*/foo'}     // No star at beginning.
    ${'/x/*/foo'}   // No star in the middle.
    ${'/&/boop'}    // No invalid component characters.
    `('throws given $arg', ({ arg }) => {
      expect(() => doCall(arg, allowWildcard)).toThrow();
    });

    // Allowed or not depending on the method.
    if (acceptsNull) {
      test.each`
      arg
      ${undefined}
      ${null}
      `('returns `null` given $arg', ({ arg }) => {
        expect(doCall(arg, allowWildcard)).toBeNull();
      });
    } else {
      test.each`
      arg
      ${undefined}
      ${null}
      `('throws given $arg', ({ arg }) => {
        expect(() => doCall(arg, allowWildcard)).toThrow();
      });
    }
  }

  describe('with default `allowWildcard` (of `false`)', () => {
    nonWildcardCases(null);
    wildcardCases(null);
    errorCases(null);
  });

  describe('with `allowWildcard === false`', () => {
    nonWildcardCases(false);
    wildcardCases(false);
    errorCases(false);
  });

  describe('with `allowWildcard === true`', () => {
    nonWildcardCases(true);
    wildcardCases(true);
    errorCases(true);
  });
});
