// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';


describe('constructor()', () => {
  describe('invalid path', () => {
    test.each([
      [undefined],
      [null],
      [false],
      ['boop'],
      [123],
      [new Set()],
      [[undefined]],
      [[true]],
      [['some-key', 123]],
      [['some-key', [], 'some-other-key']],
      [['key', 'another', ['invalid']]]
    ])('throws given %p', (value) => {
      expect(() => new TreePathKey(value, true)).toThrow();
    });
  });

  describe('invalid wildcard', () => {
    test.each([
      [undefined],
      [null],
      [0],
      ['boop'],
      [123],
      [new Set()],
      [[true]]
    ])('throws given %p', (value) => {
      expect(() => new TreePathKey([], value)).toThrow();
    });
  });

  describe('valid arguments', () => {
    test.each([
      [[], false],
      [[], true],
      [['first'], false],
      [['1', '2'], true],
      [['a', 'b', 'c', 'd', 'e', 'f', 'yes!!!'], false]
    ])('succeeds given (%p, %p)', (...args) => {
      expect(() => new TreePathKey(...args)).not.toThrow();
    });
  });
});

describe('.charLength', () => {
  test('returns `0` for an empty no-wildcard instance', () => {
    const key = new TreePathKey([], false);
    expect(key.charLength).toBe(0);
  });

  test('returns `0` for an empty wildcard instance', () => {
    const key = new TreePathKey([], true);
    expect(key.charLength).toBe(0);
  });

  test('returns the length of the sole component of a length-1 instance', () => {
    const key1 = new TreePathKey(['x'], false);
    expect(key1.charLength).toBe(1);

    const key2 = new TreePathKey(['xyz-pdq'], true);
    expect(key2.charLength).toBe(7);

    const key3 = new TreePathKey([''], false);
    expect(key3.charLength).toBe(0);
  });

  test('returns the total length of both components of a length-2 instance', () => {
    const key1 = new TreePathKey(['x', 'ab'], false);
    expect(key1.charLength).toBe(3);

    const key2 = new TreePathKey(['abc', 'defgh'], true);
    expect(key2.charLength).toBe(8);
  });

  // This is meant to verify that caching doesn't mess things up.
  test('returns the same value from repeated calls', () => {
    const key = new TreePathKey(['ab', 'cde', 'f', 'ghijklmn'], false);

    expect(key.charLength).toBe(14);
    expect(key.charLength).toBe(14);
    expect(key.charLength).toBe(14);
  });
});

describe('.length', () => {
  for (let len = 0; len < 4; len++) {
    for (let wild = 0; wild < 2; wild++) {
      const wildcard = !!wild;
      test(`works for length ${len}, wildcard ${wildcard}`, () => {
        const path = Array(len).fill('x');
        const key  = new TreePathKey(path, wildcard);
        expect(key.length).toBe(len);
      });
    }
  }
});

describe('.path', () => {
  test('is strict-equal to the `path` passed to the constructor', () => {
    const path = ['one', 'two', 'three'];
    const key  = new TreePathKey(path, false);
    expect(key.path).toStrictEqual(path);
  });

  test('is frozen even when `path` passed to the constructor is not', () => {
    const path = ['yes', 'no'];
    const key  = new TreePathKey(path, true);
    expect(key.path).toBeFrozen();
    expect(key).not.toBeFrozen();
  });

  test('is the `path` passed to the constructor when it is frozen', () => {
    const path = Object.freeze(['i', 'am', 'frozen']);
    const key  = new TreePathKey(path, true);
    expect(key.path).toBeFrozen();
    expect(key.path).toStrictEqual(path);
    expect(key.path).toBe(path);
  });
});

describe('.wildcard', () => {
  test('is `true` when constructed with `true`', () => {
    const key = new TreePathKey([], true);
    expect(key.wildcard).toBeTrue();
  });

  test('is `false` when constructed with `false`', () => {
    const key = new TreePathKey([], false);
    expect(key.wildcard).toBeFalse();
  });
});

describe('.EMPTY', () => {
  test('is an instance of the class', () => {
    expect(TreePathKey.EMPTY).toBeInstanceOf(TreePathKey);
  });

  test('is frozen', () => {
    expect(TreePathKey.EMPTY).toBeFrozen();
  });

  test('has an empty path', () => {
    expect(TreePathKey.EMPTY.path).toStrictEqual([]);
  });

  test('is not a wildcard key', () => {
    expect(TreePathKey.EMPTY.wildcard).toBeFalse();
  });
});

describe('concat()', () => {
  test('returns `this` given no arguments', () => {
    const key = new TreePathKey(['x'], false);
    expect(key.concat()).toBe(key);
  });

  test('returns `this` given an empty array', () => {
    const key = new TreePathKey(['x'], false);
    expect(key.concat([])).toBe(key);
  });

  test('returns `this` given an empty key', () => {
    const key = new TreePathKey(['x'], false);
    expect(key.concat(new TreePathKey([], true))).toBe(key);
  });

  test('concats one string', () => {
    const key    = new TreePathKey(['x'], false);
    const result = key.concat('y');

    expect(result.wildcard).toBe(key.wildcard);
    expect(result.path).toStrictEqual(['x', 'y']);
  });

  test('concats one array', () => {
    const key    = new TreePathKey(['x', 'y'], true);
    const result = key.concat(['z', 'a']);

    expect(result.wildcard).toBe(key.wildcard);
    expect(result.path).toStrictEqual(['x', 'y', 'z', 'a']);
  });

  test('concats one key', () => {
    const key    = new TreePathKey(['x'], true);
    const result = key.concat(new TreePathKey(['y', 'z', 'a'], false));

    expect(result.wildcard).toBe(key.wildcard);
    expect(result.path).toStrictEqual(['x', 'y', 'z', 'a']);
  });

  test('concats one of everything', () => {
    const key    = new TreePathKey(['x'], true);
    const result = key.concat('y', ['z'], new TreePathKey(['a', 'b'], false));

    expect(result.wildcard).toBe(key.wildcard);
    expect(result.path).toStrictEqual(['x', 'y', 'z', 'a', 'b']);
  });
});

describe('equals()', () => {
  test('is false given a non-key', () => {
    const key = new TreePathKey(['foo'], false);
    expect(key.equals('blort')).toBeFalse();
  });

  test('is false given a key with the same path but opposite wildcard', () => {
    const key1 = new TreePathKey(['foo', 'x'], false);
    const key2 = new TreePathKey(['foo', 'x'], true);
    expect(key1.equals(key2)).toBeFalse();
    expect(key2.equals(key1)).toBeFalse();
  });

  test('is false given a key with a shorter path', () => {
    const key1 = new TreePathKey(['boop', 'x', 'zorch'], false);
    const key2 = new TreePathKey(['boop', 'x'], false);
    expect(key1.equals(key2)).toBeFalse();
  });

  test('is false given a key with a longer path', () => {
    const key1 = new TreePathKey(['foo', 'x'], true);
    const key2 = new TreePathKey(['foo', 'x', 'zorch'], true);
    expect(key1.equals(key2)).toBeFalse();
  });

  test('is false given a key with a non-matching component', () => {
    const keys = [
      new TreePathKey(['a', 'b', 'c'], false),
      new TreePathKey(['X', 'b', 'c'], false),
      new TreePathKey(['a', 'X', 'c'], false),
      new TreePathKey(['a', 'b', 'X'], false)
    ];

    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < keys.length; j++) {
        if (i !== j) {
          expect(keys[i].equals(keys[j])).toBeFalse();
        }
      }
    }
  });

  test('is true given `this`', () => {
    const key = new TreePathKey(['beep'], true);
    expect(key.equals(key)).toBeTrue();
  });

  for (let i = 0; i < 10; i++) {
    test(`is true given path length ${i}`, () => {
      const path = [];
      for (let j = 0; j < i; j++) {
        path.push(`item${j}`);
      }

      const key1 = new TreePathKey(path, false);
      const key2 = new TreePathKey(path, false);
      const key3 = new TreePathKey(path, true);
      const key4 = new TreePathKey(path, true);

      expect(key1.equals(key2)).toBeTrue();
      expect(key3.equals(key4)).toBeTrue();
    });
  }
});

describe('slice()', () => {
  test('returns `this` given (0, 0) on an empty non-wildcard instance', () => {
    const key = new TreePathKey([], false);
    expect(key.slice(0, 0)).toBe(key);
  });

  test('returns a new empty instance given (0, 0) on an empty wildcard instance', () => {
    const key    = new TreePathKey([], true);
    const result = key.slice(0, 0);

    expect(result).not.toBe(key);
    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual([]);
  });

  test('returns `this` given full coverage on a non-empty non-wildcard instance', () => {
    const key = new TreePathKey(['x', 'y', 'z'], false);
    expect(key.slice(0, 3)).toBe(key);
  });

  test('returns a new instance given full coverage on a non-empty wildcard instance', () => {
    const key    = new TreePathKey(['x', 'y', 'z'], true);
    const result = key.slice(0, 3);

    expect(result).not.toBe(key);
    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual(key.path);
  });

  test('returns a new empty instance given (0, 0) on an empty wildcard instance', () => {
    const key    = new TreePathKey([], true);
    const result = key.slice(0, 0);

    expect(result).not.toBe(key);
    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual([]);
  });

  test('slices elements at the start', () => {
    const key    = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    const result = key.slice(0, 2);

    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual(['a', 'b']);
  });

  test('slices elements in the middle', () => {
    const key    = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    const result = key.slice(1, 3);

    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual(['b', 'c']);
  });

  test('slices elements at the end, when passing `end` explicitly as `length`', () => {
    const key    = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    const result = key.slice(1, 5);

    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual(['b', 'c', 'd', 'e']);
  });

  test('slices elements at the end, when not passing `end`', () => {
    const key    = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    const result = key.slice(2);

    expect(result.wildcard).toBeFalse();
    expect(result.path).toStrictEqual(['c', 'd', 'e']);
  });

  test('rejects a too-low start', () => {
    const key = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    expect(() => key.slice(-1, 2)).toThrow();
  });

  test('rejects a too-high start', () => {
    const key = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    expect(() => key.slice(6)).toThrow();
  });

  test('rejects a too-low end', () => {
    const key = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    expect(() => key.slice(2, 1)).toThrow();
  });

  test('rejects a too-high end', () => {
    const key = new TreePathKey(['a', 'b', 'c', 'd', 'e'], true);
    expect(() => key.slice(5, 6)).toThrow();
  });
});

describe('toString()', () => {
  describe('with default options', () => {
    test.each`
    path                     | wildcard | expected
    ${[]}                    | ${false} | ${'[]'}
    ${[]}                    | ${true}  | ${'[*]'}
    ${['a']}                 | ${false} | ${'[a]'}
    ${['a']}                 | ${true}  | ${'[a, *]'}
    ${['foo', 'bar', 'baz']} | ${false} | ${'[foo, bar, baz]'}
    ${['blort', 'zorch']}    | ${true}  | ${'[blort, zorch, *]'}
    `('on { path: $path, wildcard: $wildcard }', ({ path, wildcard, expected }) => {
      const key = new TreePathKey(path, wildcard);
      expect(key.toString()).toBe(expected);
    });
  });

  describe('with option `prefix`', () => {
    test.each`
    prefix   | path                  | wildcard | expected
    ${''}    | ${[]}                 | ${false} | ${']'}
    ${''}    | ${[]}                 | ${true}  | ${'*]'}
    ${'X'}   | ${['a']}              | ${false} | ${'Xa]'}
    ${'@@@'} | ${['z']}              | ${true}  | ${'@@@z, *]'}
    ${'_:'}  | ${['aa', 'bb', 'cc']} | ${true}  | ${'_:aa, bb, cc, *]'}
    `('on { path: $path, wildcard: $wildcard }, with $prefix', ({ prefix, path, wildcard, expected }) => {
      const key = new TreePathKey(path, wildcard);
      expect(key.toString({ prefix })).toBe(expected);
    });
  });

  describe('with option `suffix`', () => {
    test.each`
    suffix   | path                  | wildcard | expected
    ${''}    | ${[]}                 | ${false} | ${'['}
    ${''}    | ${[]}                 | ${true}  | ${'[*'}
    ${'X'}   | ${['a']}              | ${false} | ${'[aX'}
    ${'@@@'} | ${['z']}              | ${true}  | ${'[z, *@@@'}
    ${'!!'}  | ${['aa', 'bb', 'cc']} | ${true}  | ${'[aa, bb, cc, *!!'}
    `('on { path: $path, wildcard: $wildcard }, with $suffix', ({ suffix, path, wildcard, expected }) => {
      const key = new TreePathKey(path, wildcard);
      expect(key.toString({ suffix })).toBe(expected);
    });
  });

  describe('with option `separatePrefix`', () => {
    test.each`
    separatePrefix | path           | wildcard | expected
    ${false}       | ${[]}          | ${false} | ${'#!'}
    ${false}       | ${[]}          | ${true}  | ${'#*!'}
    ${true}        | ${[]}          | ${false} | ${'#!'}
    ${true}        | ${[]}          | ${true}  | ${'#:*!'}
    ${false}       | ${['a']}       | ${false} | ${'#a!'}
    ${false}       | ${['a']}       | ${true}  | ${'#a:*!'}
    ${true}        | ${['a']}       | ${false} | ${'#:a!'}
    ${true}        | ${['a']}       | ${true}  | ${'#:a:*!'}
    ${false}       | ${['']}        | ${false} | ${'#!'}
    ${false}       | ${['']}        | ${true}  | ${'#:*!'}
    ${true}        | ${['']}        | ${false} | ${'#:!'}
    ${true}        | ${['']}        | ${true}  | ${'#::*!'}
    ${false}       | ${['', 'abc']} | ${false} | ${'#:abc!'}
    ${false}       | ${['', 'abc']} | ${true}  | ${'#:abc:*!'}
    ${true}        | ${['', 'abc']} | ${false} | ${'#::abc!'}
    ${true}        | ${['', 'abc']} | ${true}  | ${'#::abc:*!'}
    `('on { path: $path, wildcard: $wildcard }, with $separatePrefix', ({ separatePrefix, path, wildcard, expected }) => {
      // Note: We use `prefix` and `separator` options here to make sure we can
      // distinguish what's going on. We use `suffix` just for clarity.
      const key = new TreePathKey(path, wildcard);
      expect(key.toString({ separatePrefix, prefix: '#', separator: ':', suffix: '!' })).toBe(expected);
    });
  });

  describe('with option `separator`', () => {
    test.each`
    separator | path                  | wildcard | expected
    ${''}     | ${[]}                 | ${false} | ${'[]'}
    ${''}     | ${[]}                 | ${true}  | ${'[*]'}
    ${'X'}    | ${['a']}              | ${false} | ${'[a]'}
    ${'@@@'}  | ${['a', 'z']}         | ${true}  | ${'[a@@@z@@@*]'}
    ${'!!'}   | ${['aa', 'bb', 'cc']} | ${false} | ${'[aa!!bb!!cc]'}
    `('on { path: $path, wildcard: $wildcard }, with $separator', ({ separator, path, wildcard, expected }) => {
      const key = new TreePathKey(path, wildcard);
      expect(key.toString({ separator })).toBe(expected);
    });
  });

  describe('with option `wildcard`', () => {
    test.each`
    wildcard | path                  | keyWild  | expected
    ${''}    | ${[]}                 | ${false} | ${'[]'}
    ${''}    | ${[]}                 | ${true}  | ${'[]'}
    ${''}    | ${['a']}              | ${false} | ${'[a]'}
    ${''}    | ${['a']}              | ${true}  | ${'[a, ]'}
    ${null}  | ${['a']}              | ${false} | ${'[a]'}
    ${null}  | ${['a']}              | ${true}  | ${'[a]'}
    ${'X'}   | ${['a']}              | ${false} | ${'[a]'}
    ${'X'}   | ${['a']}              | ${true}  | ${'[a, X]'}
    ${'!!'}  | ${['aa', 'bb', 'cc']} | ${true}  | ${'[aa, bb, cc, !!]'}
    `('on { path: $path, wildcard: $keyWild }, with $wildcard', ({ wildcard, path, keyWild, expected }) => {
      const key = new TreePathKey(path, keyWild);
      expect(key.toString({ wildcard })).toBe(expected);
    });
  });

  describe('with option `quote`', () => {
    test.each`
    quote    | path                     | wildcard | expected
    ${false} | ${[]}                    | ${false} | ${'[]'}
    ${false} | ${[]}                    | ${true}  | ${'[*]'}
    ${true}  | ${[]}                    | ${false} | ${'[]'}
    ${true}  | ${[]}                    | ${true}  | ${'[*]'}
    ${false} | ${['a']}                 | ${false} | ${'[a]'}
    ${false} | ${['b']}                 | ${true}  | ${'[b, *]'}
    ${true}  | ${['c']}                 | ${false} | ${"['c']"}
    ${true}  | ${['d']}                 | ${true}  | ${"['d', *]"}
    ${true}  | ${['aaa', "b'c", 'd"e']} | ${false} | ${"['aaa', \"b'c\", 'd\"e']"}
    ${true}  | ${['a\'b"c', '\n']}      | ${false} | ${"[`a'b\"c`, '\\n']"}
    ${true}  | ${['a\'b"c`d']}          | ${true}  | ${"['a\\'b\"c`d', *]"}
    `('on { path: $path, wildcard: $wildcard }, with $quote', ({ quote, path, wildcard, expected }) => {
      const key = new TreePathKey(path, wildcard);
      expect(key.toString({ quote })).toBe(expected);
    });
  });

  describe('with option `reverse`', () => {
    test.each`
    reverse  | path            | wildcard | expected
    ${false} | ${[]}           | ${false} | ${'[]'}
    ${false} | ${[]}           | ${true}  | ${'[*]'}
    ${false} | ${['a']}        | ${false} | ${'[a]'}
    ${false} | ${['a']}        | ${true}  | ${'[a, *]'}
    ${false} | ${['az', 'bc']} | ${false} | ${'[az, bc]'}
    ${false} | ${['az', 'bc']} | ${true}  | ${'[az, bc, *]'}
    ${true}  | ${[]}           | ${false} | ${'[]'}
    ${true}  | ${[]}           | ${true}  | ${'[*]'}
    ${true}  | ${['a']}        | ${false} | ${'[a]'}
    ${true}  | ${['a']}        | ${true}  | ${'[*, a]'}
    ${true}  | ${['az', 'bc']} | ${false} | ${'[bc, az]'}
    ${true}  | ${['az', 'bc']} | ${true}  | ${'[*, bc, az]'}
    `('on { path: $path, wildcard: $wildcard }, with $reverse', ({ reverse, path, wildcard, expected }) => {
      const key = new TreePathKey(path, wildcard);
      expect(key.toString({ reverse })).toBe(expected);
    });

    test('operates correctly with `reverse === true` as well as `prefix` and `suffix` set', () => {
      // This test helps catch problems due to possible confusion given the
      // other defaults.
      const key = new TreePathKey(['abc', '123', 'xyz'], true);
      const str = key.toString({ reverse: true, prefix: '[[<', suffix: '>]]' });
      expect(str).toBe('[[<*, xyz, 123, abc>]]');
    });
  });
});

describe('checkArguments()', () => {
  test('rejects `path` which is a non-array', () => {
    expect(() => TreePathKey.checkArguments(null, false)).toThrow();
    expect(() => TreePathKey.checkArguments({ a: 10 }, false)).toThrow();
  });

  test('rejects `path` which is an array of non-strings', () => {
    expect(() => TreePathKey.checkArguments([1], false)).toThrow();
    expect(() => TreePathKey.checkArguments(['a', 2, 'c'], false)).toThrow();
  });

  test('rejects `wildcard` which is non-boolean', () => {
    expect(() => TreePathKey.checkArguments(['a'], null)).toThrow();
    expect(() => TreePathKey.checkArguments(['a'], 'false')).toThrow();
    expect(() => TreePathKey.checkArguments(['a'], Object(false))).toThrow();
  });

  test('accepts `path` which is an empty array', () => {
    expect(() => TreePathKey.checkArguments([], false)).not.toThrow();
  });

  test('accepts `wildcard` which is either valid boolean', () => {
    expect(() => TreePathKey.checkArguments(['x'], false)).not.toThrow();
    expect(() => TreePathKey.checkArguments(['x'], true)).not.toThrow();
  });
});
