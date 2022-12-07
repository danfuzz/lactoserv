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
    const key   = new TreePathKey(['a'], true);
    const value = ['some value'];
    const map   = new TreePathMap();
    expect(() => map.add(key, value)).not.toThrow();
    expect(map.findExact(key)).toBe(value);
  });

  test('accepts a key-like plain object, which can then be found exactly', () => {
    const key   = { path: ['x', 'y'], wildcard: true };
    const value = ['some kinda value'];
    const map   = new TreePathMap();
    expect(() => map.add(key, value)).not.toThrow();
    expect(map.findExact(key)).toBe(value);
  });
});

describe('find()', () => {
  // TODO
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
});
