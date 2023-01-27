// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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
      [[true]],
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

describe('toString()', () => {
  // TODO
});

describe('checkArguments()', () => {
  // TODO
});
