// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


describe('bigint()', () => {
  test('accepts a bigint', () => {
    const value = 567n;
    expect(MustBe.bigint(value)).toBe(value);
  });

  test('rejects a regular number', () => {
    expect(() => MustBe.bigint(123)).toThrow();
  });

  test('accepts a bigint within specified constraints', () => {
    const value = 98765n;
    const opts  = { minInclusive: 90_000n, maxExclusive: 100_000 };
    expect(MustBe.bigint(value, opts)).toBe(value);
  });

  test('rejects a bigint outside specified constraints', () => {
    const value = 5432n;
    const opts  = { minInclusive: 6000n, maxExclusive: 7000 };
    expect(() => MustBe.bigint(value, opts)).toThrow();
  });
});

describe('arrayOfInstanceOf()', () => {
  function expectAccept(arg, cls) {
    expect(MustBe.arrayOfInstanceOf(arg, cls)).toBe(arg);
  }

  function expectReject(arg, cls) {
    expect(() => MustBe.arrayOfInstanceOf(arg, cls)).toThrow();
  }

  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${'abc1231'}
  ${1234}
  ${{ a: [1, 2, 3] }}
  `('rejects non-array: $arg', ({ arg }) => {
    expectReject(arg, Object);
  });

  test('returns a given empty array, no matter what the class', () => {
    expectAccept([], Object);
    expectAccept([], Map);
  });

  test('accepts a single-element array with matching class', () => {
    expectAccept([{}], Object);
    expectAccept([new Map()], Map);

    class SomeClass {}
    expectAccept([new SomeClass()], SomeClass);
  });

  test('accepts a multi-element array with all matching classes', () => {
    class SomeClass {}
    expectAccept([{}, new Map(), new SomeClass()], Object);
  });

  test('rejects an array with any element which fails to match the class', () => {
    expectReject(['florp', {}], Object);
    expectReject([{}, 123], Object);
    expectReject([new Map(), new Map(), {}], Map);
  });
});

describe('object()', () => {
  test('accepts a plain object', () => {
    const value = { x: 12 };
    expect(MustBe.object(value)).toBe(value);
  });

  test('accepts an instance', () => {
    const value = new Map();
    expect(MustBe.object(value)).toBe(value);
  });

  test('rejects `null`', () => {
    const value = null;
    expect(() => MustBe.object(value)).toThrow();
  });

  test('rejects a non-object', () => {
    const value = 'florp';
    expect(() => MustBe.object(value)).toThrow();
  });
});

describe('plainObject()', () => {
  test('accepts a plain object', () => {
    const value = { x: 12 };
    expect(MustBe.plainObject(value)).toBe(value);
  });

  test('rejects an instance', () => {
    const value = new Map();
    expect(() => MustBe.plainObject(value)).toThrow();
  });

  test('rejects `null`', () => {
    const value = null;
    expect(() => MustBe.plainObject(value)).toThrow();
  });

  test('rejects a non-object', () => {
    const value = 'florp';
    expect(() => MustBe.plainObject(value)).toThrow();
  });
});

describe('frozen()', () => {
  test('rejects a non-frozen plain object', () => {
    expect(() => MustBe.frozen({})).toThrow();
  });

  test('rejects a non-frozen instance', () => {
    expect(() => MustBe.frozen(new Map())).toThrow();
  });

  test('rejects a non-frozen array', () => {
    expect(() => MustBe.frozen([])).toThrow();
  });

  test('accepts a frozen plain object', () => {
    const value = Object.freeze({ x: [1, 2, 3] });
    expect(MustBe.frozen(value)).toBe(value);
  });

  test('accepts a frozen instance', () => {
    const value = Object.freeze(new Map());
    expect(MustBe.frozen(value)).toBe(value);
  });

  test('accepts a frozen array', () => {
    const value = Object.freeze([1, 2, ['a']]);
    expect(MustBe.frozen(value)).toBe(value);
  });

  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${1234n}
  ${'florp'}
  ${Symbol('x')}
  `('accepts primitive value: $arg', ({ arg }) => {
    expect(MustBe.frozen(arg)).toBe(arg);
  });
});

describe('null()', () => {
  test('accepts `null`', () => {
    expect(MustBe.null(null)).toBe(null);
  });

  test.each`
  arg
  ${undefined}
  ${false}
  ${0}
  ${0n}
  ${''}
  ${'x'}
  ${Symbol('x')}
  ${[123]}
  ${{ a: 123 }}
  `('rejects non-`null` value: $arg', ({ arg }) => {
    expect(() => MustBe.null(arg)).toThrow();
  });
});
