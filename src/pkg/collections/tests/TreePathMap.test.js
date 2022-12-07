// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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

describe('add()', () => {
  test('accepts a `TreePathKey`, which can then be found exactly', () => {
    const key1  = new TreePathKey(['a'], true);
    const key2  = { path: ['a'], wildcard: true };
    const value = ['some value'];
    const map   = new TreePathMap();
    expect(() => map.add(key1, value)).not.toThrow();
    expect(map.findExact(key1)).toBe(value);
    expect(map.findExact(key2)).toBe(value);
  });

  test('accepts a key-like plain object, which can then be found exactly', () => {
    const key1  = new TreePathKey(['x', 'y'], false);
    const key2  = { path: ['x', 'y'], wildcard: false };
    const value = ['some kinda value'];
    const map   = new TreePathMap();
    expect(() => map.add(key2, value)).not.toThrow();
    expect(map.findExact(key1)).toBe(value);
    expect(map.findExact(key2)).toBe(value);
  });
});

describe('find()', () => {
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

describe('findExact()', () => {
  test('returns `null` when a key is not found, if `ifNotFound` was not passed', () => {
    const map = new TreePathMap();
    expect(map.findExact({ path: ['x'], wildcard: false })).toBeNull();
  });

  test('returns the `ifNotFound` value when a key is not found', () => {
    const map   = new TreePathMap();
    const value = ['whatever'];
    expect(map.findExact(new TreePathKey([], true), value)).toBe(value);
  });

  test('finds an already-added key, when passed as a `TreePathKey`', () => {
    const key1  = new TreePathKey(['1', '2', '3'], false);
    const key2  = new TreePathKey(['1', '2', '3'], false);
    const value = ['yes', 'a value'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expect(map.findExact(key1)).toBe(value);
    expect(map.findExact(key2)).toBe(value);
  });

  test('finds an already-added key, when passed as a key-like plain object', () => {
    const key1  = { path: ['yo', 'there'], wildcard: true };
    const key2  = { path: ['yo', 'there'], wildcard: true };
    const value = ['yeppers', 'still a value'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expect(map.findExact(key1)).toBe(value);
    expect(map.findExact(key2)).toBe(value);
  });

  test('does not find an added wildcard key, when passed a non-wildcard', () => {
    const key1  = new TreePathKey(['1'], true);
    const key2  = new TreePathKey(['1'], false);
    const value = ['yo there'];
    const map   = new TreePathMap();

    map.add(key1, value);
    expect(map.findExact(key2)).toBeNull();
  });

  test('does not find an added non-wildcard key, when passed a wildcard', () => {
    const key1  = new TreePathKey(['1'], true);
    const key2  = new TreePathKey(['1'], false);
    const value = ['yo there'];
    const map   = new TreePathMap();

    map.add(key2, value);
    expect(map.findExact(key1)).toBeNull();
  });
});
