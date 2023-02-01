// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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
