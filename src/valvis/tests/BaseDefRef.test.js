// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseDefRef } from '@this/valvis';


describe('constructor()', () => {
  test('doesn\'t throw given a valid argument', () => {
    expect(() => new BaseDefRef(0)).not.toThrow();
  });
});

describe('.def', () => {
  test('throws', () => {
    const obj = new BaseDefRef(1);
    expect(() => obj.def).toThrow();
  });
});

describe('.index', () => {
  test('is the `index` from the constructor', () => {
    const obj = new BaseDefRef(101);
    expect(obj.index).toBe(101);
  });
});

describe('.ref', () => {
  test('throws', () => {
    const obj = new BaseDefRef(1);
    expect(() => obj.ref).toThrow();
  });
});

describe('.value', () => {
  test('throws', () => {
    const obj = new BaseDefRef(1);
    expect(() => obj.value).toThrow();
  });
});

describe('isFinished()', () => {
  test('throws', () => {
    const obj = new BaseDefRef(1);
    expect(() => obj.isFinished()).toThrow();
  });
});
