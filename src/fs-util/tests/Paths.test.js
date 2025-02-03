// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Paths } from '@this/fs-util';


describe('mustBeAbsolutePath()', () => {
  // Errors: Wrong argument type.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${true}
  ${123}
  ${['/x/y']}
  ${new Map()}
  `('fails for $arg', ({ arg }) => {
    expect(() => Paths.mustBeAbsolutePath(arg)).toThrow();
  });

  // Errors: Invalid string syntax.
  test.each`
  arg
  ${''}
  ${'a'}
  ${'a/b'}
  ${'//a'}
  ${'/a/'}
  ${'/a//'}
  ${'/a//b'}
  ${'/a//b/'}
  ${'/a/.'}
  ${'/a/./b'}
  ${'/a/..'}
  ${'/a/../b'}
  ${'/a/b/'}
  `('fails for $arg', ({ arg }) => {
    expect(() => Paths.mustBeAbsolutePath(arg)).toThrow();
  });

  // Correct cases.
  test.each`
  arg
  ${'/'}
  ${'/a'}
  ${'/abc'}
  ${'/abc/def'}
  `('succeeds for $arg', ({ arg }) => {
    expect(Paths.mustBeAbsolutePath(arg)).toBe(arg);
  });
});

describe('mustBeFileName()', () => {
  // Errors: Wrong argument type.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${true}
  ${123}
  ${['/x/y']}
  ${new Map()}
  `('fails for $arg', ({ arg }) => {
    expect(() => Paths.mustBeFileName(arg)).toThrow();
  });

  // Errors: Invalid string syntax.
  test.each`
  arg
  ${''}
  ${'.'}
  ${'..'}
  ${'/'}
  ${'/a'}
  ${'a/'}
  ${'a/b'}
  `('fails for $arg', ({ arg }) => {
    expect(() => Paths.mustBeFileName(arg)).toThrow();
  });

  // Correct cases.
  test.each`
  arg
  ${'a'}
  ${'abc'}
  ${'.a'}
  ${'a.'}
  ${'a.b'}
  ${'..a'}
  ${'a..'}
  ${'a..b'}
  `('succeeds for $arg', ({ arg }) => {
    expect(Paths.mustBeFileName(arg)).toBe(arg);
  });
});
