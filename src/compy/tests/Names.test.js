// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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
