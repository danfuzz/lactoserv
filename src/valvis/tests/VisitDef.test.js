// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { VisitDef } from '@this/valvis';


describe('constructor()', () => {
  test('doesn\'t throw when not given a `value`', () => {
    expect(() => new VisitDef(0, null)).not.toThrow();
  });

  test('doesn\'t throw when given a `value`', () => {
    expect(() => new VisitDef(0, null, 'floomp')).not.toThrow();
  });
});

describe('.def', () => {
  test('returns `this`', () => {
    const def = new VisitDef(1, null);
    expect(def.def).toBe(def);
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const def = new VisitDef(2, null, 'bongo');
    expect(def.toJSON()).toStrictEqual({ '@def': [2, 'bongo'] });
  });
});
