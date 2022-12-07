// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TreePathKey, TreePathMap } from '@this/collections';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new TreePathMap()).not.toThrow();
  });
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

  // TODO: More tests!
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
