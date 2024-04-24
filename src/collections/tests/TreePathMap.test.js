// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey, TreePathMap } from '@this/collections';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new TreePathMap()).not.toThrow();
  });
});

describe('.size', () => {
  const keys = [
    new PathKey([], true),
    new PathKey([], false),
    new PathKey(['x'], false),
    new PathKey(['x', 'y'], false),
    new PathKey(['x', 'y'], true),
    new PathKey(['a', 'b', 'c'], false),
    new PathKey(['a', 'b', 'c', 'x'], true),
    new PathKey(['a', 'b', 'c', 'x', 'y'], true)
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
    const key   = new PathKey(['foo', 'bar'], false);
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
  test('accepts a `PathKey`, which can then be found exactly', () => {
    const key1  = new PathKey(['a'], true);
    const key2  = { path: ['a'], wildcard: true };
    const value = ['some value'];
    const map   = new TreePathMap();
    expect(() => map.add(key1, value)).not.toThrow();
    expect(map.get(key1)).toBe(value);
    expect(map.get(key2)).toBe(value);
  });

  test('accepts a key-like plain object, which can then be found exactly', () => {
    const key1  = new PathKey(['x', 'y'], false);
    const key2  = { path: ['x', 'y'], wildcard: false };
    const value = ['some kinda value'];
    const map   = new TreePathMap();
    expect(() => map.add(key2, value)).not.toThrow();
    expect(map.get(key1)).toBe(value);
    expect(map.get(key2)).toBe(value);
  });

  test('allows a wildcard key to be added even when a same-path non-wildcard is already in the map', () => {
    const keyNorm = new PathKey(['yes', 'maybe'], false);
    const keyWild = new PathKey(['yes', 'maybe'], true);
    const map     = new TreePathMap();

    map.add(keyNorm, 'x');
    expect(() => map.add(keyWild, 'x')).not.toThrow();
    expect(map.size).toBe(2);
  });

  test('allows a non-wildcard key to be added even when a same-path wildcard is already in the map', () => {
    const keyNorm = new PathKey(['yes', 'maybe'], false);
    const keyWild = new PathKey(['yes', 'maybe'], true);
    const map     = new TreePathMap();

    map.add(keyWild, 'x');
    expect(() => map.add(keyNorm, 'x')).not.toThrow();
    expect(map.size).toBe(2);
  });

  test('fails to add a non-wildcard key that has already been added', () => {
    const key = new PathKey(['hey what?'], false);
    const map = new TreePathMap();

    map.add(key, 'x');
    expect(() => map.add(key, 'x')).toThrow();
    expect(map.size).toBe(1);
  });

  test('fails to add a wildcard key that has already been added', () => {
    const key = new PathKey(['hey what?'], true);
    const map = new TreePathMap();

    map.add(key, 'x');
    expect(() => map.add(key, 'x')).toThrow();
    expect(map.size).toBe(1);
  });

  describe('error messages', () => {
    test('have the expected initial text', () => {
      const key = new PathKey(['beep', 'boop'], true);
      const map = new TreePathMap();

      map.add(key, 'x');
      expect(() => map.add(key, 'x')).toThrow(/^Key already bound: /);
    });

    test('uses the default key renderer when none was specified upon construction', () => {
      const key = new PathKey(['a', 'b'], false);
      const map = new TreePathMap();

      map.add(key, 'x');
      expect(() => map.add(key, 'x')).toThrow(/^[^:]+: \[a, b\]$/);
    });

    test('uses the default key renderer when `null` was specified upon construction', () => {
      const key = new PathKey(['a', 'b'], true);
      const map = new TreePathMap(null);

      map.add(key, 'x');
      expect(() => map.add(key, 'x')).toThrow(/^[^:]+: \[a, b, \*\]$/);
    });

    test('uses the key renderer specified upon construction', () => {
      let   gotKey  = null;
      const theFunc = (k) => {
        gotKey = k;
        return 'zoinks';
      };

      const key = new PathKey(['blorp'], false);
      const map = new TreePathMap(theFunc);

      map.add(key, 'x');
      expect(() => map.add(key, 'x')).toThrow(/^[^:]+: zoinks$/);
      expect(gotKey).toBe(key);
    });
  });
});

describe('entries()', () => {
  test('handles a large-ish example', () => {
    // This is a "smokey" test.
    const bindings = new Map([
      [new PathKey([], false), 'one'],
      [new PathKey(['boop'], false), ['two']],
      [new PathKey(['beep'], true), ['three', 3]],
      [new PathKey(['z', 'y'], true), Symbol('four')],
      [new PathKey(['z', 'y', 'z'], false), { five: 'five' }],
      [new PathKey(['a'], true), 'six'],
      [new PathKey(['a', 'b'], true), 'seven'],
      [new PathKey(['c', 'd', 'c'], false), 'eight'],
      [new PathKey(['c', 'd', 'cc'], false), 'nine'],
      [new PathKey(['c', 'd', 'cc', 'd'], true), 'ten']
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

  test('yields non-wildcard before wildcard keys at the same depth', () => {
    const map1 = new TreePathMap();
    map1.add(new PathKey([], true), 'wild');
    map1.add(new PathKey([], false), 'regular');

    const entries1 = [...map1.entries()];
    expect(entries1[0][1]).toBe('regular');
    expect(entries1[1][1]).toBe('wild');

    const map2 = new TreePathMap();
    map2.add(new PathKey(['x', 'y'], false), 'woo-regular');
    map2.add(new PathKey(['x', 'y'], true), 'woo-wild');

    const entries2 = [...map2.entries()];
    expect(entries2[0][1]).toBe('woo-regular');
    expect(entries2[1][1]).toBe('woo-wild');
  });

  test('yields less deep keys first', () => {
    const map = new TreePathMap();
    map.add(new PathKey([], false), 'one');
    map.add(new PathKey(['a'], false), 'two');
    map.add(new PathKey(['a', 'b'], false), 'three');

    const entries = [...map.entries()];
    expect(entries[0][1]).toBe('one');
    expect(entries[1][1]).toBe('two');
    expect(entries[2][1]).toBe('three');
  });

  test('yields siblings in sorted order', () => {
    const map = new TreePathMap();
    map.add(new PathKey(['c'], false), 'three');
    map.add(new PathKey(['a'], false), 'one');
    map.add(new PathKey(['b'], false), 'two');

    const entries = [...map.entries()];
    expect(entries[0][1]).toBe('one');
    expect(entries[1][1]).toBe('two');
    expect(entries[2][1]).toBe('three');
  });

  test('yields subtrees in their entirety without interjecting sibling entries', () => {
    const map = new TreePathMap();
    map.add(new PathKey(['b'], false), 'yes-1');
    map.add(new PathKey(['c'], false), 'nope');
    map.add(new PathKey(['b', '1'], false), 'yes-2');
    map.add(new PathKey(['a'], false), 'nope');
    map.add(new PathKey(['b', '2'], false), 'yes-4');
    map.add(new PathKey(['b', '1', 'x'], false), 'yes-3');

    const entries = [...map.entries()];
    expect(entries.length).toBe(6);
    expect(entries[0][1]).toBe('nope');
    expect(entries[5][1]).toBe('nope');
    for (let i = 1; i <= 4; i++) {
      expect(entries[i][1]).toBe(`yes-${i}`);
    }
  });
});

describe('find()', () => {
  describe('given a non-wildcard key', () => {
    test('finds an already-added key, when an exact match is passed as a `PathKey`', () => {
      const key   = new PathKey(['1', '2', '3'], false);
      const value = ['florp'];
      const map   = new TreePathMap();

      map.add(key, value);
      const result = map.find(key);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key);
      expect(result.keyRemainder).toBe(PathKey.EMPTY);
      expect(result.value).toBe(value);
    });

    test('finds an already-added key, when an exact match passed as a key-like plain object', () => {
      const key1  = new PathKey(['1', '2', '3'], false);
      const key2  = { path: ['1', '2', '3'], wildcard: false };
      const value = ['florp'];
      const map   = new TreePathMap();

      map.add(key1, value);
      const result = map.find(key2);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key1);
      expect(result.keyRemainder).toBe(PathKey.EMPTY);
      expect(result.value).toBe(value);
    });

    test('finds an already-added wildcard, when a matching non-wildcard key is passed', () => {
      const key1  = new PathKey(['one', 'two'], true);
      const key2  = new PathKey(['one', 'two'], false);
      const key3  = new PathKey(['one', 'two', 'three'], false);
      const value = ['boop'];
      const map   = new TreePathMap();

      map.add(key1, value);

      const result1 = map.find(key2);
      expect(result1).not.toBeNull();
      expect(result1.key).toBe(key1);
      expect(result1.keyRemainder).toBe(PathKey.EMPTY);
      expect(result1.value).toBe(value);

      const result2 = map.find(key3);
      expect(result2).not.toBeNull();
      expect(result2.key).toBe(key1);
      expect(result2.keyRemainder.path).toStrictEqual(['three']);
      expect(result2.keyRemainder.wildcard).toBeFalse();
      expect(result2.value).toBe(value);
    });

    test('finds a wildcard binding at the exact key', () => {
      const key1  = new PathKey(['i', 'love', 'muffins'], true);
      const key2  = new PathKey(['i', 'love', 'muffins'], false);
      const value = ['blueberry'];
      const map   = new TreePathMap();

      map.add(key1, value);

      const result = map.find(key2);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key1);
      expect(result.keyRemainder.path).toStrictEqual([]);
      expect(result.keyRemainder.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('finds a wildcard binding "below" the key being looked up', () => {
      const key1  = new PathKey(['top'], true);
      const key2  = new PathKey(['top', 'middle'], false);
      const key3  = new PathKey(['top', 'middle', 'bottom'], false);
      const value = ['florp'];
      const map   = new TreePathMap();

      map.add(key1, value);
      map.add(key2, 'y');

      const result = map.find(key3);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key1);
      expect(result.keyRemainder.path).toStrictEqual(['middle', 'bottom']);
      expect(result.keyRemainder.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('finds the most specific wildcard binding "below" the key being looked up', () => {
      const key1  = new PathKey(['top'], true);
      const key2  = new PathKey(['top', 'middle'], true);
      const key3  = new PathKey(['top', 'middle', 'bottom'], false);
      const value = ['florp', 'like'];
      const map   = new TreePathMap();

      map.add(key1, 'x');
      map.add(key2, value);

      const result = map.find(key3);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key2);
      expect(result.keyRemainder.path).toStrictEqual(['bottom']);
      expect(result.keyRemainder.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('does not find a non-wildcard binding "below" the key being looked up', () => {
      const key1 = new PathKey(['top'], false);
      const key2 = new PathKey(['top', 'middle'], false);
      const key3 = new PathKey(['top', 'middle', 'bottom'], false);
      const map  = new TreePathMap();

      map.add(key1, 'x');
      map.add(key2, 'y');

      const result = map.find(key3);
      expect(result).toBeNull();
    });
  });

  describe('given a wildcard key', () => {
    test('finds an already-added wildcard, when a matching key is passed as a `PathKey`', () => {
      const key1  = new PathKey(['one', 'two'], true);
      const key2  = new PathKey(['one', 'two', 'three'], true);
      const value = ['boop'];
      const map   = new TreePathMap();

      map.add(key1, value);

      const result1 = map.find(key1);
      expect(result1).not.toBeNull();
      expect(result1.key).toBe(key1);
      expect(result1.keyRemainder).toBe(PathKey.EMPTY);
      expect(result1.value).toBe(value);

      const result2 = map.find(key2);
      expect(result2).not.toBeNull();
      expect(result2.key).toBe(key1);
      expect(result2.keyRemainder.path).toStrictEqual(['three']);
      expect(result2.keyRemainder.wildcard).toBeFalse();
      expect(result2.value).toBe(value);
    });

    test('finds an already-added wildcard, when a matching key is passed as a plain object', () => {
      const key1  = new PathKey(['a', 'b', 'c'], true);
      const value = ['boop'];
      const map   = new TreePathMap();

      map.add(key1, value);

      const result = map.find({ path: ['a', 'b', 'c'], wildcard: true });
      expect(result).not.toBeNull();
      expect(result.key).toBe(key1);
      expect(result.keyRemainder).toBe(PathKey.EMPTY);
      expect(result.value).toBe(value);
    });

    test('does not find a non-wildcard binding "below" the key being looked up', () => {
      const key1 = new PathKey(['top'], false);
      const key2 = new PathKey(['top', 'middle'], false);
      const key3 = new PathKey(['top', 'middle', 'bottom'], true);
      const map  = new TreePathMap();

      map.add(key1, 'x');
      map.add(key2, 'y');

      const result = map.find(key3);
      expect(result).toBeNull();
    });

    test('finds a wildcard binding "below" the key being looked up', () => {
      const key1  = new PathKey(['top'], true);
      const key2  = new PathKey(['top', 'middle'], false);
      const key3  = new PathKey(['top', 'middle', 'bottom'], true);
      const value = { beep: 'boop' };
      const map   = new TreePathMap();

      map.add(key1, value);
      map.add(key2, 'y');

      const result = map.find(key3);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key1);
      expect(result.keyRemainder.path).toStrictEqual(['middle', 'bottom']);
      expect(result.keyRemainder.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('finds the most-specific wildcard binding "below" the key being looked up', () => {
      const key1  = new PathKey(['top'], true);
      const key2  = new PathKey(['top', 'middle'], true);
      const key3  = new PathKey(['top', 'middle', 'bottom'], true);
      const value = { zeep: 'zoop' };
      const map   = new TreePathMap();

      map.add(key1, 'x');
      map.add(key2, value);

      const result = map.find(key3);
      expect(result).not.toBeNull();
      expect(result.key).toBe(key2);
      expect(result.keyRemainder.path).toStrictEqual(['bottom']);
      expect(result.keyRemainder.wildcard).toBeFalse();
      expect(result.value).toBe(value);
    });

    test('does not find a non-wildcard, when a would-match wildcard key is passed', () => {
      const key1  = new PathKey(['one', 'two'], false);
      const key2  = new PathKey(['one', 'two'], true);
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
      const key1 = new PathKey(['a'], true);
      const key2 = new PathKey(['a'], false);

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

  test('does not produce a `next` even with multiple matches', () => {
    const key1 = new PathKey([], true);
    const key2 = new PathKey(['x'], true);
    const key3 = new PathKey(['x', 'y'], true);
    const key4 = new PathKey(['x', 'y'], false);

    const map = new TreePathMap();
    map.add(key1, 'a');
    map.add(key2, 'b');
    map.add(key3, 'c');
    map.add(key4, 'd');

    const result = map.find(key4);
    expect(result).not.toBeNull();
    expect(result).not.toContainKey('next');
    expect(result.key).toBe(key4);
    expect(result.value).toBe('d');
  });
});

describe('findSubtree()', () => {
  test('returns an instance with the same `keyStringFunc`.', () => {
    const ksf    = () => 'florp';
    const key    = new PathKey(['x'], true);
    const map    = new TreePathMap(ksf);
    const result = map.findSubtree(key);

    expect(result.stringFromKey(key)).toBe('florp');
  });

  describe('given an empty-path wildcard key', () => {
    const key = new PathKey([], true);

    test('returns an empty (but different object) result if there are no bindings', () => {
      const map    = new TreePathMap();
      const result = map.findSubtree(key);
      expect(result.size).toBe(0);
      expect(result).not.toBe(map);
    });

    test('returns a single top-level non-wildcard binding, if that is what is in the map', () => {
      const key1   = new PathKey([], false);
      const value1 = ['a value'];
      const map    = new TreePathMap();

      map.add(key1, value1);
      const result = map.findSubtree(key);
      expect(result.size).toBe(1);
      expect(result.get(key1)).toBe(value1);
    });

    test('returns a single top-level wildcard binding, if that is what is in the map', () => {
      const value = ['still a value'];
      const map   = new TreePathMap();

      map.add(key, value);
      const result = map.findSubtree(key);
      expect(result.size).toBe(1);
      expect(result.get(key)).toBe(value);
    });

    test('returns both wildcard and non-wildcard top-level bindings, if that is what is in the map', () => {
      const value1 = ['first value'];
      const key2  = new PathKey([], false);
      const value2 = ['second value'];
      const map    = new TreePathMap();

      map.add(key, value1);
      map.add(key2, value2);
      const result = map.findSubtree(key);
      expect(result.size).toBe(2);
      expect(result.get(key)).toBe(value1);
      expect(result.get(key2)).toBe(value2);
    });

    test('returns all bindings in the map (but in a different object), generally', () => {
      // This is a "smokey" test.
      const bindings = new Map([
        [new PathKey([], false), 'one'],
        [new PathKey(['x'], false), 'two'],
        [new PathKey(['x'], true), 'three'],
        [new PathKey(['x', 'y'], true), 'four'],
        [new PathKey(['x', 'y', 'z'], false), 'five'],
        [new PathKey(['a'], true), 'six'],
        [new PathKey(['a', 'b'], true), 'seven'],
        [new PathKey(['a', 'b', 'c'], false), 'eight'],
        [new PathKey(['a', 'b', 'cc'], false), 'nine'],
        [new PathKey(['a', 'b', 'cc', 'd'], true), 'ten']
      ]);
      const map = new TreePathMap();

      for (const [k, v] of bindings) {
        map.add(k, v);
      }

      const result = map.findSubtree(key);
      expect(result.size).toBe(bindings.size);
      expect(result).not.toBe(map);

      for (const [k, v] of bindings) {
        expect(result.get(k)).toBe(v);
      }
    });
  });

  test('finds an exact non-wildcard match, given a non-wildcard key', () => {
    const key   = new PathKey(['1', '2'], false);
    const value = 'value';
    const map   = new TreePathMap();

    map.add(key, value);
    const result = map.findSubtree(key);
    expect(result.size).toBe(1);
    expect(result.get(key)).toBe(value);
  });

  test('finds an exact wildcard match, given a non-wildcard key', () => {
    const key1  = new PathKey(['1', '2'], true);
    const key2  = new PathKey(['1', '2'], false);
    const value = 'some-value';
    const map   = new TreePathMap();

    map.add(key1, value);
    const result = map.findSubtree(key2);
    expect(result.size).toBe(1);
    expect(result.get(key2)).toBe(value);
  });

  test('finds a wildcard match, given a non-wildcard key', () => {
    const key1  = new PathKey(['1', '2'], true);
    const key2  = new PathKey(['1', '2', '3', '4'], false);
    const value = 'some-other-value';
    const map   = new TreePathMap();

    map.add(key1, value);
    const result = map.findSubtree(key2);
    expect(result.size).toBe(1);
    expect(result.get(key2)).toBe(value);
  });

  test('extracts a subtree, given a wildcard key', () => {
    // This is a "smokey" test.
    const key      = new PathKey(['in', 'here'], true);
    const bindings = new Map([
      [new PathKey(['in', 'here'], false), 'one'],
      [new PathKey(['in', 'here'], true), 'two'],
      [new PathKey(['in', 'here', 'x'], true), 'three'],
      [new PathKey(['in', 'here', 'x', 'y'], false), 'four'],
      [new PathKey(['in', 'here', 'a', 'b', 'c'], false), 'five'],
      [new PathKey(['in', 'here', 'a', 'b'], true), 'six'],
      [new PathKey(['in', 'here', 'a', 'x', 'y'], false), 'seven'],
      [new PathKey(['in', 'here', 'a', 'z'], true), 'eight']
    ]);
    const extraBindings = new Map([
      [new PathKey([], false), 'one'],
      [new PathKey(['x'], false), 'two'],
      [new PathKey(['x'], true), 'three'],
      [new PathKey(['x', 'y'], true), 'four'],
      [new PathKey(['x', 'y', 'z'], false), 'five'],
      [new PathKey(['a'], true), 'six'],
      [new PathKey(['a', 'b'], true), 'seven'],
      [new PathKey(['a', 'b', 'c'], false), 'eight'],
      [new PathKey(['a', 'b', 'cc'], false), 'nine'],
      [new PathKey(['a', 'b', 'cc', 'd'], true), 'ten']
    ]);
    const map = new TreePathMap();

    for (const [k, v] of [...bindings, ...extraBindings]) {
      map.add(k, v);
    }

    const result = map.findSubtree(key);
    expect(result.size).toBe(bindings.size);

    for (const [k, v] of bindings) {
      expect(result.get(k)).toBe(v);
    }
  });
});

describe('findWithFallback()', () => {
  test('finds multiple matches in the expected order', () => {
    const key1 = new PathKey([], true);
    const key2 = new PathKey(['x'], true);
    const key3 = new PathKey(['x', 'y'], true);
    const key4 = new PathKey(['x', 'y'], false);

    const map = new TreePathMap();
    map.add(key1, 'a');
    map.add(key2, 'b');
    map.add(key3, 'c');
    map.add(key4, 'd');

    const result = [...map.findWithFallback(key4)];
    expect(result).toBeArrayOfSize(4);

    expect(result[0].key).toBe(key4);
    expect(result[0].value).toBe('d');
    expect(result[0].keyRemainder.path).toStrictEqual([]);

    expect(result[1].key).toBe(key3);
    expect(result[1].value).toBe('c');
    expect(result[1].keyRemainder.path).toStrictEqual([]);

    expect(result[2].key).toBe(key2);
    expect(result[2].value).toBe('b');
    expect(result[2].keyRemainder.path).toStrictEqual(['y']);

    expect(result[3].key).toBe(key1);
    expect(result[3].value).toBe('a');
    expect(result[3].keyRemainder.path).toStrictEqual(['x', 'y']);
  });

  test('correctly finds a single match', () => {
    const key1 = new PathKey([], false);
    const key2 = new PathKey(['x'], false);
    const key3 = new PathKey(['x', 'y'], false);
    const key4 = new PathKey(['x', 'y', 'z'], false);

    const map = new TreePathMap();
    map.add(key1, 'a');
    map.add(key2, 'b');
    map.add(key3, 'c');
    map.add(key4, 'd');

    const result = [...map.findWithFallback(key3)];
    expect(result).toBeArrayOfSize(1);

    expect(result[0].key).toBe(key3);
    expect(result[0].keyRemainder.path).toStrictEqual([]);
    expect(result[0].value).toBe('c');
  });

  test('returns an immediately `done` generator if there is no match', () => {
    const key1 = new PathKey([], false);
    const key2 = new PathKey(['x'], false);
    const key3 = new PathKey(['x', 'y'], false);

    const map = new TreePathMap();
    map.add(key1, 'a');
    map.add(key2, 'b');

    const result = map.findWithFallback(key3).next();
    expect(result).toContainKey('done');
    expect(result.done).toBeTrue();
    expect(result.value).toBeUndefined();
  });

  test('does not find a non-wildcard prefix match', () => {
    const key1 = new PathKey([], true);
    const key2 = new PathKey(['x'], false);
    const key3 = new PathKey(['x', 'y'], true);

    const map = new TreePathMap();
    map.add(key1, 'a');
    map.add(key2, 'b');
    map.add(key3, 'c');

    const result = [...map.findWithFallback(key3)];
    expect(result).toBeArrayOfSize(2);

    expect(result[0].key).toBe(key3);
    expect(result[0].keyRemainder.path).toStrictEqual([]);
    expect(result[0].value).toBe('c');

    expect(result[1].key).toBe(key1);
    expect(result[1].keyRemainder.path).toStrictEqual(['x', 'y']);
    expect(result[1].value).toBe('a');
  });
});

// Common tests for both `get()` and `find()`.
describe.each`
methodName | expectBoolean
${'get'}   | ${false}
${'has'}   | ${true}
`('$methodName()', ({ methodName, expectBoolean }) => {
  function expectFound(map, key, value) {
    const got = map[methodName](key);
    if (expectBoolean) {
      expect(got).toBeTrue();
    } else {
      expect(got).toBe(value);
    }
  }

  function expectNotFound(map, key) {
    const got = map[methodName](key);
    if (expectBoolean) {
      expect(got).toBeFalse();
    } else {
      expect(got).toBeNull();
    }
  }

  test('finds an already-added key, when passed as a `PathKey`', () => {
    const key1  = new PathKey(['1', '2', '3'], false);
    const key2  = new PathKey(['1', '2', '3'], false);
    const value = ['yes', 'a value'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expectFound(map, key1, value);
    expectFound(map, key2, value);
  });

  test('finds an already-added key, when passed as a key-like plain object', () => {
    const key1  = { path: ['yo', 'there'], wildcard: true };
    const key2  = { path: ['yo', 'there'], wildcard: true };
    const value = ['yeppers', 'still a value'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expectFound(map, key1, value);
    expectFound(map, key2, value);
  });

  test('does not find an added wildcard key, when passed a non-wildcard', () => {
    const key1  = new PathKey(['1'], true);
    const key2  = new PathKey(['1'], false);
    const value = ['yo there'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expectNotFound(map, key2);
  });

  test('does not find an added non-wildcard key, when passed a wildcard', () => {
    const key1  = new PathKey(['1'], true);
    const key2  = new PathKey(['1'], false);
    const value = ['yo there'];
    const map   = new TreePathMap();

    map.add(key2, value);
    expectNotFound(map, key1);
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
    expect(map.get(new PathKey([], true), value)).toBe(value);
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
        const key = new PathKey(['abc'], true);

        map.add(key, value);

        const result = map.get(key, notFound);
        expect(result).toBe(value);
      });

      test('finds it when bound to a non-wildcard', () => {
        const map = new TreePathMap();
        const key = new PathKey(['abc'], false);

        map.add(key, value);

        const result = map.get(key, notFound);
        expect(result).toBe(value);
      });
    });
  });
});

describe('has()', () => {
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
      test('finds it when bound to a wildcard', () => {
        const map = new TreePathMap();
        const key = new PathKey(['abc'], true);

        map.add(key, value);

        const result = map.has(key);
        expect(result).toBeTrue();
      });

      test('finds it when bound to a non-wildcard', () => {
        const map = new TreePathMap();
        const key = new PathKey(['abc'], false);

        map.add(key, value);

        const result = map.has(key);
        expect(result).toBeTrue();
      });
    });
  });
});

describe('stringFromKey()', () => {
  test('uses the default function when not specified in the constructor', () => {
    const map = new TreePathMap();

    const key1 = new PathKey([], true);
    const s1   = map.stringFromKey(key1);
    expect(s1).toBe(key1.toString());

    const key2 = new PathKey(['foo', 'bar'], false);
    const s2   = map.stringFromKey(key2);
    expect(s2).toBe(key2.toString());
  });

  test('uses the default function when `null` was specified in the constructor', () => {
    const map = new TreePathMap(null);

    const key1 = new PathKey(['x', 'y', 'zonk'], true);
    const s1   = map.stringFromKey(key1);
    expect(s1).toBe(key1.toString());

    const key2 = new PathKey(['florp'], false);
    const s2   = map.stringFromKey(key2);
    expect(s2).toBe(key2.toString());
  });

  test('uses the function specified in the constructor', () => {
    const gotArgs = [];
    const theFunc = (k) => {
      gotArgs.push(k);
      return `yes-${gotArgs.length}`;
    };

    const key1 = new PathKey(['x'], true);
    const key2 = new PathKey(['y'], false);
    const map = new TreePathMap(theFunc);

    const s1 = map.stringFromKey(key1);
    const s2 = map.stringFromKey(key2);
    expect(s1).toBe('yes-1');
    expect(s2).toBe('yes-2');
    expect(gotArgs).toBeArrayOfSize(2);
    expect(gotArgs[0]).toBe(key1);
    expect(gotArgs[1]).toBe(key2);
  });
});
