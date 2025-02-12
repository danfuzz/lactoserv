// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Inspecty } from '@this/valvis';

describe.each`
methodName                | expectVar
${'labelFromValue'} | ${'expectedLabel'}
${'nameFromValue'}  | ${'expectedName'}
`('$methodName()', ({ methodName, expectVar }) => {
  // These are expected to return their stringified versions.
  test.each`
  value
  ${null}
  ${undefined}
  ${true}
  ${123}
  ${567n}
  ${'zonk'}
  `('stringifies $value', ({ value }) => {
    const got = Inspecty[methodName](value);
    expect(got).toBe(`${value}`);
  });

  // Special cases that don't work with proxies.
  test.each`
  label                     | value                 | expectedName     | expectedLabel
  ${'the empty string'}     | ${''}                 | ${'<anonymous>'} | ${'<anonymous>'}
  ${'an interned symbol'}   | ${Symbol.for('boop')} | ${'boop'}        | ${'symbol {boop}'}
  ${'an uninterned symbol'} | ${Symbol('bloop')}    | ${'bloop'}       | ${'symbol {bloop}'}
  ${'an anonymous class'}   | ${class {}}           | ${'<anonymous>'} | ${'class <anonymous>'}
  ${'a named class'}        | ${class Florp {}}     | ${'Florp'}       | ${'class Florp'}
  `('returns the expected form for $label', ({ value, ...expected }) => {
    const got = Inspecty[methodName](value);
    expect(got).toBe(expected[expectVar]);
  });

  /**
   * A class which has a `.name` property.
   */
  class AvecName {
    get name() {
      return 'a-name';
    }
  }

  // An instance with a `.constructor` that isn't actually a function.
  const nonFuncConstructor = new Map();
  nonFuncConstructor.constructor = 'florp';

  // The rest.
  describe.each`
  label            | doProxy
  ${'a proxy'}     | ${true}
  ${'a non-proxy'} | ${false}
  `('$label', ({ doProxy }) => {
    test.each`
    label                                           | value                           | expectedName     | expectedLabel
    ${'an anonymous plain object'}                  | ${{ a: 123 }}                   | ${'<anonymous>'} | ${'object {...}'}
    ${'a named plain object'}                       | ${{ name: 'flomp' }}            | ${'flomp'}       | ${'flomp {...}'}
    ${'an instance of anonymous class'}             | ${new (class {})()}             | ${'<anonymous>'} | ${'<anonymous> {...}'}
    ${'an instance of named class'}                 | ${new (class Boop {})()}        | ${'<anonymous>'} | ${'Boop {...}'}
    ${'an instance with a `.name`'}                 | ${new AvecName()}               | ${'a-name'}      | ${'AvecName a-name {...}'}
    ${'an instance with a non-func `.constructor`'} | ${nonFuncConstructor}           | ${'<anonymous>'} | ${'<anonymous> {...}'}
    ${'an anonymous function'}                      | ${() => 123}                    | ${'<anonymous>'} | ${'<anonymous>()'}
    ${'a named function'}                           | ${function bip() { return 1; }} | ${'bip'}         | ${'bip()'}
    `('derives the expected name from $label', ({ value, ...expected }) => {
      if (doProxy && (expectVar === 'expectedLabel')) {
        value    = new Proxy(value, {});
        expected = `Proxy {${expected[expectVar]}}`;
      } else {
        expected = expected[expectVar];
      }

      const got = Inspecty[methodName](value);
      expect(got).toBe(expected);
    });
  });
});
