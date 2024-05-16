// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf } from '@this/typey';

describe('arrayOf()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${'abc1231'}
  ${1234}
  ${{ a: [1, 2, 3] }}
  `('returns `false` for non-array: $arg', ({ arg }) => {
    expect(AskIf.arrayOf(arg, () => true)).toBeFalse();
  });

  test('returns `true` no matter what the predicate, given an empty array', () => {
    expect(AskIf.arrayOf([], () => false)).toBeTrue();
  });

  test('returns `false` if the predicate ever returns `false`', () => {
    const predicate = (elem) => (elem === 'boop');
    expect(AskIf.arrayOf([1, 2, 3, 'boop', 4, 5], predicate)).toBeFalse();
  });

  test('returns `true` if the predicate always returns `true`', () => {
    expect(AskIf.arrayOf([[], new Map(), 'boop', 4, 5], () => true)).toBeTrue();
  });

  test('actually calls the predicate for each element if they all pass', () => {
    const args = ['a', 'b', 'c', 12345, [1, 2, 3]];
    const callArgs = [];
    const predicate = (elem) => {
      callArgs.push(elem);
      return true;
    };

    expect(AskIf.arrayOf(args, predicate)).toBeTrue();
    expect(callArgs).toEqual(args);
    expect(callArgs[4]).toBe(args[4]);
  });
});

describe('arrayOfString()', () => {
  test.each`
  arg
  ${'x'}
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${123n}
  ${{ x: 'x' }}
  ${Symbol('x')}
  ${[false]}
  ${['x', null]}
  ${[[], 'x']}
  `('returns `false` given $arg', ({ arg }) => {
    expect(AskIf.arrayOfString(arg)).toBeFalse();
  });

  test.each`
  arg
  ${[]}
  ${['x']}
  ${['floop!']}
  ${['a', 'b', 'c']}
  `('returns `true` given `$arg`', ({ arg }) => {
    expect(AskIf.arrayOfString(arg)).toBeTrue();
  });

  test('throws given an invalid match `match`', () => {
    expect(() => AskIf.arrayOfString(['x'], ['boop'])).toThrow();
  });

  test.each`
  value               | match                        | expected
  ${[]}               | ${null}                      | ${true}
  ${['x']}            | ${null}                      | ${true}
  ${['x', 'y']}       | ${null}                      | ${true}
  ${123}              | ${null}                      | ${false}
  ${123}              | ${/blorp/}                   | ${false}
  ${123}              | ${new Set(['x'])}            | ${false}
  ${[123]}            | ${null}                      | ${false}
  ${[123]}            | ${/blorp/}                   | ${false}
  ${[123]}            | ${new Set(['x'])}            | ${false}
  ${['x', 123]}       | ${null}                      | ${false}
  ${[123, 'b']}       | ${/b/}                       | ${false}
  ${['x', 123]}       | ${new Set(['x'])}            | ${false}
  ${['xyz']}          | ${/y/}                       | ${true}
  ${['xyz', 'y']}     | ${/y/}                       | ${true}
  ${['xyz']}          | ${/w/}                       | ${false}
  ${['xyz', 'w']}     | ${/w/}                       | ${false}
  ${['abc']}          | ${'^ab'}                     | ${true}
  ${['abc', 'abd']}   | ${'^ab'}                     | ${true}
  ${['abc']}          | ${'z'}                       | ${false}
  ${['abc', 'z']}     | ${'z'}                       | ${false}
  ${['boop']}         | ${new Set(['beep', 'boop'])} | ${true}
  ${['boop', 'beep']} | ${new Set(['beep', 'boop'])} | ${true}
  ${['bop']}          | ${new Set(['zip', 'zap'])}   | ${false}
  ${['bop', 'zip']}   | ${new Set(['zip', 'zap'])}   | ${false}
  `('returns $expected given ($value, $match)', ({ value, match, expected }) => {
    expect(AskIf.arrayOfString(value, match)).toBe(expected);
  });
});

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

describe('string()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${123n}
  ${Symbol('x')}
  ${['x']}
  ${{ x: 'x' }}
  `('returns `false` given $arg', ({ arg }) => {
    expect(AskIf.string(arg)).toBeFalse();
  });

  test.each`
  arg
  ${''}
  ${'x'}
  ${'floop!'}
  `('returns `true` given string `$arg`', ({ arg }) => {
    expect(AskIf.string(arg)).toBeTrue();
  });

  test('throws given an invalid match `match`', () => {
    expect(() => AskIf.string('x', ['boop'])).toThrow();
  });

  test.each`
  value     | match                        | expected
  ${'x'}    | ${null}                      | ${true}
  ${123}    | ${null}                      | ${false}
  ${123}    | ${/blorp/}                   | ${false}
  ${123}    | ${new Set(['x'])}            | ${false}
  ${'xyz'}  | ${/y/}                       | ${true}
  ${'xyz'}  | ${/w/}                       | ${false}
  ${'abc'}  | ${'^ab'}                     | ${true}
  ${'abc'}  | ${'z'}                       | ${false}
  ${'boop'} | ${new Set(['beep', 'boop'])} | ${true}
  ${'bop'}  | ${new Set(['zip', 'zap'])}   | ${false}
  `('returns $expected given ($value, $match)', ({ value, match, expected }) => {
    expect(AskIf.string(value, match)).toBe(expected);
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
