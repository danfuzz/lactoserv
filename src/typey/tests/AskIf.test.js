// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf } from '@this/typey';


// TODO: Almost everything.

describe('callableFunction()', () => {
  describe('non-functions', () => {
    test.each`
    value
    ${undefined}
    ${null}
    ${false}
    ${true}
    ${0}
    ${1n}
    ${'hello'}
    ${[1, 2, 3]}
    ${{ a: 10 }}
    ${Symbol('blort')}
    ${new Map()}
    `('returns false given $value', ({ value }) => {
      expect(AskIf.callableFunction(value)).toBeFalse();
    });
  });

  describe('non-constructor functions', () => {
    class Boop {
      beep() { return 123; }
    }

    test.each`
    label                              | value
    ${'a classic `function` function'} | ${function () { return 123; }}
    ${'an arrow function'}             | ${() => 123}
    ${'a modern class\'s method'}      | ${new Boop().beep}
    `('returns true given $label', ({ value }) => {
      expect(AskIf.callableFunction(value)).toBeTrue();
    });
  });

  test('returns false given a modern class', () => {
    expect(AskIf.callableFunction(class Bonk { })).toBeFalse();
  });

  describe('proxies', () => {
    test('returns `false` given a revoked proxy', () => {
      const { proxy, revoke } = Proxy.revocable(() => 123, {});
      revoke();
      expect(AskIf.callableFunction(proxy)).toBeFalse();
    });

    test('returns `true` given a proxy to an arrow function', () => {
      const proxy = new Proxy(() => 123, {});
      expect(AskIf.callableFunction(proxy)).toBeTrue();
    });

    test('returns `true` given a proxy to a classic `function` function', () => {
      const proxy = new Proxy(function () { return 123; }, {});
      expect(AskIf.callableFunction(proxy)).toBeTrue();
    });
  });

  describe('does not actually call', () => {
    test('a modern class', () => {
      let count = 0;
      class Bonk {
        constructor() {
          count++;
        }
      }

      // Baseline expectation.
      expect(AskIf.callableFunction(Bonk)).toBeFalse();

      // The actual test.
      expect(count).toBe(0);
    });

    test('a classic `function` function', () => {
      let count = 0;
      function florp() { count++; }

      // Baseline expectation.
      expect(AskIf.callableFunction(florp)).toBeTrue();

      // The actual test.
      expect(count).toBe(0);
    });

    test('an arrow function', () => {
      let count = 0;
      const florp = () => { count++; };

      // Baseline expectation.
      expect(AskIf.callableFunction(florp)).toBeTrue();

      // The actual test.
      expect(count).toBe(0);
    });
  });
});

describe('constructorFunction()', () => {
  describe('non-functions', () => {
    test.each`
    value
    ${undefined}
    ${null}
    ${false}
    ${true}
    ${0}
    ${1n}
    ${'hello'}
    ${[1, 2, 3]}
    ${{ a: 10 }}
    ${Symbol('blort')}
    ${new Map()}
    `('returns false given $value', ({ value }) => {
      expect(AskIf.constructorFunction(value)).toBeFalse();
    });
  });

  describe('non-constructor functions', () => {
    class Boop {
      beep() { return 123; }
    }

    test.each`
    label                         | value
    ${'an arrow function'}        | ${() => 123}
    ${'a modern class\'s method'} | ${new Boop().beep}
    `('returns false given $label', ({ value }) => {
      expect(AskIf.constructorFunction(value)).toBeFalse();
    });
  });

  describe('proper constructor functions', () => {
    test.each`
    label                   | value
    ${'a modern class'}     | ${class Bloop { }}
    ${'built-in class Map'} | ${Map}
    `('returns true given $label', ({ value }) => {
      expect(AskIf.constructorFunction(value)).toBeTrue();
    });
  });

  test('returns true given a classic `function` function', () => {
    function florp() { return 123; }
    expect(AskIf.constructorFunction(florp)).toBeTrue();
  });

  describe('proxies', () => {
    test('returns `false` given a revoked proxy', () => {
      const { proxy, revoke } = Proxy.revocable(Map, {});
      revoke();
      expect(AskIf.constructorFunction(proxy)).toBeFalse();
    });

    test('returns `true` given a proxy to a built-in class', () => {
      const proxy = new Proxy(Map, {});
      expect(AskIf.constructorFunction(proxy)).toBeTrue();
    });

    test('returns `true` given a proxy to a modern class', () => {
      const proxy = new Proxy(class Beep { }, {});
      expect(AskIf.constructorFunction(proxy)).toBeTrue();
    });
  });

  describe('does not actually call or construct', () => {
    test('a modern class', () => {
      let count = 0;
      class Bonk {
        constructor() {
          count++;
        }
      }

      // Baseline expectation.
      expect(AskIf.constructorFunction(Bonk)).toBeTrue();

      // The actual test.
      expect(count).toBe(0);
    });

    test('a classic `function` function', () => {
      let count = 0;
      function florp() { count++; }

      // Baseline expectation.
      expect(AskIf.constructorFunction(florp)).toBeTrue();

      // The actual test.
      expect(count).toBe(0);
    });

    test('an arrow function', () => {
      let count = 0;
      const florp = () => { count++; };

      // Baseline expectation.
      expect(AskIf.constructorFunction(florp)).toBeFalse();

      // The actual test.
      expect(count).toBe(0);
    });
  });
});

describe('object()', () => {
  test.each`
  value
  ${null}
  ${undefined}
  ${false}
  ${true}
  ${0}
  ${123n}
  ${'florp'}
  ${Symbol('florp')}
  `('returns `false` given $value', ({ value }) => {
    expect(AskIf.object(value)).toBeFalse();
  });

  test.each`
  value
  ${{}}
  ${[]}
  ${{ a: 10 }}
  ${[1, 2, 3]}
  ${new Map()}
  `('returns `true` given $value', ({ value }) => {
    expect(AskIf.object(value)).toBeTrue();
  });
});

describe('subclassOf()', () => {
  describe('on non-classes', () => {
    test.each`
    value
    ${undefined}
    ${false}
    ${true}
    ${0}
    ${'florp'}
    ${['florp', 'bloop']}
    ${{ a: 100 }}
    ${new Map()}
    `('returns false given $value', ({ value }) => {
      expect(AskIf.subclassOf(value, Object)).toBeFalse();
    });
  });

  test('throws when given an invalid `baseClass`', () => {
    expect(() => AskIf.subclassOf(Object, 123)).toThrow();
  });

  test('indicates a class counts as a "subclass" of itself (improper relationship)', () => {
    class Florp {}

    expect(AskIf.subclassOf(Object, Object)).toBeTrue();
    expect(AskIf.subclassOf(Map, Map)).toBeTrue();
    expect(AskIf.subclassOf(Florp, Florp)).toBeTrue();
  });

  test('indicates that all classes are subclasses of `Object`', () => {
    class Florp {}
    class Bloop extends Florp {}

    expect(AskIf.subclassOf(Object, Object)).toBeTrue();
    expect(AskIf.subclassOf(Map, Object)).toBeTrue();
    expect(AskIf.subclassOf(Florp, Object)).toBeTrue();
    expect(AskIf.subclassOf(Bloop, Object)).toBeTrue();
  });

  test('indicates that `Object` is not a subclass of any other class', () => {
    class Florp {}
    class Bloop extends Florp {}

    expect(AskIf.subclassOf(Object, Map)).toBeFalse();
    expect(AskIf.subclassOf(Object, Florp)).toBeFalse();
    expect(AskIf.subclassOf(Object, Bloop)).toBeFalse();
  });

  test('indicates that a declared subclass is in fact a subclass, including indirectly', () => {
    class Top {}
    class Middle extends Top {}
    class Bottom extends Middle {}

    expect(AskIf.subclassOf(Bottom, Middle)).toBeTrue();
    expect(AskIf.subclassOf(Bottom, Top)).toBeTrue();
  });

  test('indicates that a declared superclass is in fact a superclass, including indirectly', () => {
    class Top {}
    class Middle extends Top {}
    class Bottom extends Middle {}

    expect(AskIf.subclassOf(Top, Middle)).toBeFalse();
    expect(AskIf.subclassOf(Top, Bottom)).toBeFalse();
  });
});
