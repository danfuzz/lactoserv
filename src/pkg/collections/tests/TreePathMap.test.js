// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { TreePathKey, TreePathMap } from '@this/collections';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new TreePathMap()).not.toThrow();
  });
});

describe('.size', () => {
  const keys = [
    new TreePathKey([], true),
    new TreePathKey([], false),
    new TreePathKey(['x'], false),
    new TreePathKey(['x', 'y'], false),
    new TreePathKey(['x', 'y'], true),
    new TreePathKey(['a', 'b', 'c'], false),
    new TreePathKey(['a', 'b', 'c', 'x'], true),
    new TreePathKey(['a', 'b', 'c', 'x', 'y'], true)
  ];

  for (let i = 0; i < keys.length; i++) {
    test(`correctly returns ${i}`, () => {
      const map = new TreePathMap();
      for (let j = 0; j < i; j++) {
        map.add(keys[j], [`value-${j}`]);
      }
      expect(map.size).toBe(i);
    });
  }
});

// Tests for basic functionality, which should be the same for both of these.
describe.each`
label                  | method
${'[Symbol.iterator]'} | ${Symbol.iterator}
${'entries'}           | ${'entries'}
`('$label()', ({ method }) => {
  test('returns an object with the right methods', () => {
    const map = new TreePathMap();

    const result = map[method]();
    expect(result.next).toBeFunction();
    expect(result[Symbol.iterator]).toBeFunction();
  });

  test('returns an object which returns itself when asked to iterate', () => {
    const map = new TreePathMap();

    const result = map[method]();
    expect(result[Symbol.iterator]()).toBe(result);
  });

  test('succeeds in running a no-entry iteration', () => {
    const map = new TreePathMap();

    const result = map[method]().next();
    expect(result).toStrictEqual({ value: undefined, done: true });
  });

  test('succeeds in running a one-entry iteration', () => {
    const key   = new TreePathKey(['foo', 'bar'], false);
    const value = ['florp'];
    const map   = new TreePathMap();

    map.add(key, value);
    const iter = map[method]();

    const result1 = iter.next();
    expect(result1.value[0]).toBe(key);
    expect(result1.value[1]).toBe(value);
    expect(result1.done).toBeBoolean();

    if (!result1.done) {
      const result2 = iter.next();
      expect(result2).toStrictEqual({ value: undefined, done: true });
    }
  });
});

describe('add()', () => {
  test('accepts a `TreePathKey`, which can then be found exactly', () => {
    const key1  = new TreePathKey(['a'], true);
    const key2  = { path: ['a'], wildcard: true };
    const value = ['some value'];
    const map   = new TreePathMap();
    expect(() => map.add(key1, value)).not.toThrow();
    expect(map.get(key1)).toBe(value);
    expect(map.get(key2)).toBe(value);
  });

  test('accepts a key-like plain object, which can then be found exactly', () => {
    const key1  = new TreePathKey(['x', 'y'], false);
    const key2  = { path: ['x', 'y'], wildcard: false };
    const value = ['some kinda value'];
    const map   = new TreePathMap();
    expect(() => map.add(key2, value)).not.toThrow();
    expect(map.get(key1)).toBe(value);
    expect(map.get(key2)).toBe(value);
  });
});

describe('entries()', () => {
  test('handles a large-ish example', () => {
    // This is a "smokey" test.
    const bindings = new Map([
      [new TreePathKey([], false), 'one'],
      [new TreePathKey(['boop'], false), ['two']],
      [new TreePathKey(['beep'], true), ['three', 3]],
      [new TreePathKey(['z', 'y'], true), Symbol('four')],
      [new TreePathKey(['z', 'y', 'z'], false), { five: 'five' }],
      [new TreePathKey(['a'], true), 'six'],
      [new TreePathKey(['a', 'b'], true), 'seven'],
      [new TreePathKey(['c', 'd', 'c'], false), 'eight'],
      [new TreePathKey(['c', 'd', 'cc'], false), 'nine'],
      [new TreePathKey(['c', 'd', 'cc', 'd'], true), 'ten']
    ]);
    const map = new TreePathMap();

    for (const [k, v] of bindings) {
      map.add(k, v);
    }

    const resultMap = new TreePathMap();
    for (const [k, v] of map.entries()) {
      expect(bindings.has(k)).toBeTrue();
      expect(bindings.get(k)).toBe(v);

      // Note that `add` doesn't allow duplicates, so this test will implicitly
      // end up checking that each key appears only once.
      resultMap.add(k, v);
    }

    for (const [k, v] of bindings) {
      const found = resultMap.get(k);
      expect(found).toBe(v);
    }
  });
});

describe('find()', () => {
  describe('given a non-wildcard key', () => {
    test('finds an already-added key, when an exact match is passed as a `TreePathKey`', () => {
      const key   = new TreePathKey(['1', '2', '3'], false);
      const value = ['florp'];
      const map   = new TreePathMap();

      map.add(key, value);
      const result = map.find(key);
      expect(result).not.toBeNull();
      expect(result.path).toStrictEqual(key.path);
      expect(result.pathRemainder).toStrictEqual([]);
      expect(result.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('finds an already-added key, when an exact match passed as a key-like plain object', () => {
      const key1  = new TreePathKey(['1', '2', '3'], false);
      const key2  = { path: ['1', '2', '3'], wildcard: false };
      const value = ['florp'];
      const map   = new TreePathMap();

      map.add(key1, value);
      const result = map.find(key2);
      expect(result).not.toBeNull();
      expect(result.path).toStrictEqual(key1.path);
      expect(result.pathRemainder).toStrictEqual([]);
      expect(result.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('finds an already-added wildcard, when a matching non-wildcard key is passed', () => {
      const key1  = new TreePathKey(['one', 'two'], true);
      const key2  = new TreePathKey(['one', 'two'], false);
      const key3  = new TreePathKey(['one', 'two', 'three'], false);
      const value = ['boop'];
      const map   = new TreePathMap();

      map.add(key1, value);

      const result1 = map.find(key2);
      expect(result1).not.toBeNull();
      expect(result1.path).toStrictEqual(key1.path);
      expect(result1.pathRemainder).toStrictEqual([]);
      expect(result1.wildcard).toBeTrue();
      expect(result1.value).toBe(value);

      const result2 = map.find(key3);
      expect(result2).not.toBeNull();
      expect(result2.path).toStrictEqual(key1.path);
      expect(result2.pathRemainder).toStrictEqual(['three']);
      expect(result2.wildcard).toBeTrue();
      expect(result2.value).toBe(value);
    });
  });

  describe('given a wildcard key', () => {
    test('finds an already-added wildcard, when a matching wildcard key is passed', () => {
      const key1  = new TreePathKey(['one', 'two'], true);
      const key2  = new TreePathKey(['one', 'two', 'three'], true);
      const value = ['boop'];
      const map   = new TreePathMap();

      map.add(key1, value);

      const result1 = map.find(key1);
      expect(result1).not.toBeNull();
      expect(result1.path).toStrictEqual(key1.path);
      expect(result1.pathRemainder).toStrictEqual([]);
      expect(result1.wildcard).toBeTrue();
      expect(result1.value).toBe(value);

      const result2 = map.find(key2);
      expect(result2).not.toBeNull();
      expect(result2.path).toStrictEqual(key1.path);
      expect(result2.pathRemainder).toStrictEqual(['three']);
      expect(result2.wildcard).toBeTrue();
      expect(result2.value).toBe(value);
    });

    test('does not find an already-added non-wildcard, when a would-match wildcard key is passed', () => {
      const key1  = new TreePathKey(['one', 'two'], false);
      const key2  = new TreePathKey(['one', 'two'], true);
      const value = ['beep'];
      const map   = new TreePathMap();

      map.add(key1, value);
      expect(map.find(key2)).toBeNull();
    });
  });

  describe('nullish values', () => {
    describe.each([
      [undefined],
      [null],
      [false],
      [0],
      [''],
      [[]],
      [{}]
    ])('for %p', (value) => {
      const key1 = new TreePathKey(['a'], true);
      const key2 = new TreePathKey(['a'], false);

      test('finds it when bound to a wildcard', () => {
        const map = new TreePathMap();

        map.add(key1, value);

        const result1 = map.find(key1);
        expect(result1).not.toBeNull();
        expect(result1.value).toBe(value);

        const result2 = map.find(key2);
        expect(result2).not.toBeNull();
        expect(result2.value).toBe(value);
      });

      test('finds it when bound to a non-wildcard', () => {
        const map = new TreePathMap();

        map.add(key2, value);

        const result2 = map.find(key2);
        expect(result2).not.toBeNull();
        expect(result2.value).toBe(value);
      });
    });
  });
});

describe('findAllBindings()', () => {
  describe('given an empty-path wildcard key', () => {
    const key = new TreePathKey([], true);

    test('returns an empty (but different object) result if there are no bindings', () => {
      const map    = new TreePathMap();
      const result = map.findAllBindings(key);
      expect(result.size).toBe(0);
      expect(result).not.toBe(map);
    });

    test('returns a single top-level non-wildcard binding, if that is what is in the map', () => {
      const key1   = new TreePathKey([], false);
      const value1 = ['a value'];
      const map    = new TreePathMap();

      map.add(key1, value1);
      const result = map.findAllBindings(key);
      expect(result.size).toBe(1);
      expect(result.get(key1)).toBe(value1);
    });

    test('returns a single top-level wildcard binding, if that is what is in the map', () => {
      const value = ['still a value'];
      const map   = new TreePathMap();

      map.add(key, value);
      const result = map.findAllBindings(key);
      expect(result.size).toBe(1);
      expect(result.get(key)).toBe(value);
    });

    test('returns both wildcard and non-wildcard top-level bindings, if that is what is in the map', () => {
      const value1 = ['first value'];
      const key2  = new TreePathKey([], false);
      const value2 = ['second value'];
      const map    = new TreePathMap();

      map.add(key, value1);
      map.add(key2, value2);
      const result = map.findAllBindings(key);
      expect(result.size).toBe(2);
      expect(result.get(key)).toBe(value1);
      expect(result.get(key2)).toBe(value2);
    });

    test('returns all bindings in the map (but in a different object), generally', () => {
      // This is a "smokey" test.
      const bindings = new Map([
        [new TreePathKey([], false), 'one'],
        [new TreePathKey(['x'], false), 'two'],
        [new TreePathKey(['x'], true), 'three'],
        [new TreePathKey(['x', 'y'], true), 'four'],
        [new TreePathKey(['x', 'y', 'z'], false), 'five'],
        [new TreePathKey(['a'], true), 'six'],
        [new TreePathKey(['a', 'b'], true), 'seven'],
        [new TreePathKey(['a', 'b', 'c'], false), 'eight'],
        [new TreePathKey(['a', 'b', 'cc'], false), 'nine'],
        [new TreePathKey(['a', 'b', 'cc', 'd'], true), 'ten']
      ]);
      const map = new TreePathMap();

      for (const [k, v] of bindings) {
        map.add(k, v);
      }

      const result = map.findAllBindings(key);
      expect(result.size).toBe(bindings.size);
      expect(result).not.toBe(map);

      for (const [k, v] of bindings) {
        expect(result.get(k)).toBe(v);
      }
    });
  });

  test('finds an exact non-wildcard match, given a non-wildcard key', () => {
    const key   = new TreePathKey(['1', '2'], false);
    const value = 'value';
    const map   = new TreePathMap();

    map.add(key, value);
    const result = map.findAllBindings(key);
    expect(result.size).toBe(1);
    expect(result.get(key)).toBe(value);
  });

  test('finds an exact wildcard match, given a non-wildcard key', () => {
    const key1  = new TreePathKey(['1', '2'], true);
    const key2  = new TreePathKey(['1', '2'], false);
    const value = 'some-value';
    const map   = new TreePathMap();

    map.add(key1, value);
    const result = map.findAllBindings(key2);
    expect(result.size).toBe(1);
    expect(result.get(key2)).toBe(value);
  });

  test('finds a wildcard match, given a non-wildcard key', () => {
    const key1  = new TreePathKey(['1', '2'], true);
    const key2  = new TreePathKey(['1', '2', '3', '4'], false);
    const value = 'some-other-value';
    const map   = new TreePathMap();

    map.add(key1, value);
    const result = map.findAllBindings(key2);
    expect(result.size).toBe(1);
    expect(result.get(key2)).toBe(value);
  });

  test('extracts a subtree, given a wildcard key', () => {
    // This is a "smokey" test.
    const key      = new TreePathKey(['in', 'here'], true);
    const bindings = new Map([
      [new TreePathKey(['in', 'here'], false), 'one'],
      [new TreePathKey(['in', 'here'], true), 'two'],
      [new TreePathKey(['in', 'here', 'x'], true), 'three'],
      [new TreePathKey(['in', 'here', 'x', 'y'], false), 'four'],
      [new TreePathKey(['in', 'here', 'a', 'b', 'c'], false), 'five'],
      [new TreePathKey(['in', 'here', 'a', 'b'], true), 'six'],
      [new TreePathKey(['in', 'here', 'a', 'x', 'y'], false), 'seven'],
      [new TreePathKey(['in', 'here', 'a', 'z'], true), 'eight'],
    ]);
    const extraBindings = new Map([
      [new TreePathKey([], false), 'one'],
      [new TreePathKey(['x'], false), 'two'],
      [new TreePathKey(['x'], true), 'three'],
      [new TreePathKey(['x', 'y'], true), 'four'],
      [new TreePathKey(['x', 'y', 'z'], false), 'five'],
      [new TreePathKey(['a'], true), 'six'],
      [new TreePathKey(['a', 'b'], true), 'seven'],
      [new TreePathKey(['a', 'b', 'c'], false), 'eight'],
      [new TreePathKey(['a', 'b', 'cc'], false), 'nine'],
      [new TreePathKey(['a', 'b', 'cc', 'd'], true), 'ten']
    ]);
    const map = new TreePathMap();

    for (const [k, v] of [...bindings, ...extraBindings]) {
      map.add(k, v);
    }

    const result = map.findAllBindings(key);
    expect(result.size).toBe(bindings.size);

    for (const [k, v] of bindings) {
      expect(result.get(k)).toBe(v);
    }
  });
});

describe('get()', () => {
  test('returns `null` when a key is not found, if `ifNotFound` was not passed', () => {
    const map = new TreePathMap();
    expect(map.get({ path: ['x'], wildcard: false })).toBeNull();
  });

  test('returns the `ifNotFound` value when a key is not found', () => {
    const map   = new TreePathMap();
    const value = ['whatever'];
    expect(map.get(new TreePathKey([], true), value)).toBe(value);
  });

  test('finds an already-added key, when passed as a `TreePathKey`', () => {
    const key1  = new TreePathKey(['1', '2', '3'], false);
    const key2  = new TreePathKey(['1', '2', '3'], false);
    const value = ['yes', 'a value'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expect(map.get(key1)).toBe(value);
    expect(map.get(key2)).toBe(value);
  });

  test('finds an already-added key, when passed as a key-like plain object', () => {
    const key1  = { path: ['yo', 'there'], wildcard: true };
    const key2  = { path: ['yo', 'there'], wildcard: true };
    const value = ['yeppers', 'still a value'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expect(map.get(key1)).toBe(value);
    expect(map.get(key2)).toBe(value);
  });

  test('does not find an added wildcard key, when passed a non-wildcard', () => {
    const key1  = new TreePathKey(['1'], true);
    const key2  = new TreePathKey(['1'], false);
    const value = ['yo there'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expect(map.get(key2)).toBeNull();
  });

  test('does not find an added non-wildcard key, when passed a wildcard', () => {
    const key1  = new TreePathKey(['1'], true);
    const key2  = new TreePathKey(['1'], false);
    const value = ['yo there'];
    const map   = new TreePathMap();

    map.add(key2, value);
    expect(map.get(key1)).toBeNull();
  });

  describe('nullish values', () => {
    describe.each([
      [undefined],
      [null],
      [false],
      [0],
      [''],
      [[]],
      [{}]
    ])('for %p', (value) => {
      const notFound = 'not-actually-there';

      test('finds it when bound to a wildcard', () => {
        const map = new TreePathMap();
        const key = new TreePathKey(['abc'], true);

        map.add(key, value);

        const result = map.get(key, notFound);
        expect(result).toBe(value);
      });

      test('finds it when bound to a non-wildcard', () => {
        const map = new TreePathMap();
        const key = new TreePathKey(['abc'], false);

        map.add(key, value);

        const result = map.get(key, notFound);
        expect(result).toBe(value);
      });
    });
  });
});
