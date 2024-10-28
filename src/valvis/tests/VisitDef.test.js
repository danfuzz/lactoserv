// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { VisitDef, VisitRef } from '@this/valvis';


describe('constructor()', () => {
  test('doesn\'t throw when not given a `value`', () => {
    expect(() => new VisitDef(0)).not.toThrow();
  });

  test('doesn\'t throw when given a `value`', () => {
    expect(() => new VisitDef(0, 'floomp')).not.toThrow();
  });
});

describe('.def', () => {
  test('returns `this`', () => {
    const def = new VisitDef(1);
    expect(def.def).toBe(def);
  });
});

describe('.index', () => {
  test('is the `index` from the constructor', () => {
    const def = new VisitDef(998);
    expect(def.index).toBe(998);
  });
});

describe('.ref', () => {
  test('returns a ref with the same index', () => {
    const def = new VisitDef(199);
    expect(def.ref).toBeInstanceOf(VisitRef);
    expect(def.ref.index).toBe(def.index);
  });
});

describe('.value', () => {
  test('is the value from the constructor, if constructed with a value', () => {
    const value = 'bloop';
    const def = new VisitDef(1, value);
    expect(def.value).toBe(value);
  });

  test('is the value from the call to `finishWithValue()`', () => {
    const value = 'bleep';
    const def = new VisitDef(2);

    def.finishWithValue(value);
    expect(def.value).toBe(value);
  });

  test('throws if constructed without a value, and no `finish*()` call was made', () => {
    const def = new VisitDef(2);
    expect(() => def.value).toThrow(/Not yet finished./);
  });

  test('throws the error set by `finishWithError()`', () => {
    const def = new VisitDef(3);
    const err = new Error('Nope!');

    def.finishWithError(err);
    expect(() => def.value).toThrow(err);
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const def = new VisitDef(2, 'bongo');
    expect(def.toJSON()).toStrictEqual({ '@def': [2, 'bongo'] });
  });
});
