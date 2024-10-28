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

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const def = new VisitDef(2, 'bongo');
    expect(def.toJSON()).toStrictEqual({ '@def': [2, 'bongo'] });
  });
});
