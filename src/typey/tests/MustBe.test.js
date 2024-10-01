// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
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
