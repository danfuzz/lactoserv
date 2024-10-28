// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { VisitDef, VisitRef } from '@this/valvis';


describe('constructor()', () => {
  test('doesn\'t throw given a def', () => {
    expect(() => new VisitRef(new VisitDef(0))).not.toThrow();
  });
});

describe('.def', () => {
  test('returns the `def` passed in the constructor', () => {
    const def = new VisitDef(22);
    const ref = new VisitRef(def);
    expect(ref.def).toBe(def);
  });
});

describe('.index', () => {
  test('is the `index` of the corresponding def', () => {
    const def = new VisitDef(585);
    const ref = new VisitRef(def);
    expect(ref.index).toBe(585);
  });
});

describe('.ref', () => {
  test('returns `this`', () => {
    const ref = new VisitRef(new VisitDef(1, null));
    expect(ref.ref).toBe(ref);
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const ref = new VisitRef(new VisitDef(2, null));
    expect(ref.toJSON()).toStrictEqual({ '@ref': [2] });
  });
});
