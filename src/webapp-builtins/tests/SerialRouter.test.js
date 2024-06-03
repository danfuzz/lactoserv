// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SerialRouter } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new SerialRouter({
      applications: []
    })).not.toThrow();
  });

  test('accepts a valid configuration with applications', () => {
    expect(() => new SerialRouter({
      applications: ['foo', 'bar', 'baz']
    })).not.toThrow();
  });

  test.each`
  name
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${123n}
  ${['x']}
  ${{ a: 'x' }}
  ${''}         // This and the rest are syntactically incorrect names.
  ${'-zonk'}
  ${'zonk-'}
  ${'ab$cd'}
  ${' this '}
  `('does not allow binding to `$name`', ({ name }) => {
    const applications = [name];
    expect(() => new SerialRouter({ applications })).toThrow();
  });
});
