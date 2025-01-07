// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/sexp';
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

describe('deconstruct()', () => {
  test('returns the `def` from the constructor', () => {
    const def      = new VisitDef(456, 'floop');
    const ref      = new VisitRef(def);
    const expected = new Sexp(VisitRef, def);
    expect(ref.deconstruct()).toStrictEqual(expected);
  });
});

describe('isFinished()', () => {
  test('is `false` when the associated `def` is unfinished', () => {
    const def = new VisitDef(901);
    const ref = new VisitRef(def);
    expect(ref.isFinished()).toBeFalse();
  });

  test('is `true` when the associated `def` is finished', () => {
    const def = new VisitDef(902, 'bloop');
    const ref = new VisitRef(def);
    expect(ref.isFinished()).toBeTrue();
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const ref = new VisitRef(new VisitDef(2, null));
    expect(ref.toJSON()).toStrictEqual({ '@ref': [2] });
  });
});

// This validates that it's safe to use `expect(ref).toStrictEqual(ref)`
// in test cases throughout the system.
describe('validating Jest usage', () => {
  test('can use `expect().toStrictEqual()` to check the defs\' `index`', () => {
    const def1a = new VisitDef(1, 'boop');
    const def1b = new VisitDef(1, 'boop');
    const def2  = new VisitDef(2, 'boop');
    const ref1a = new VisitRef(def1a);
    const ref1b = new VisitRef(def1b);
    const ref2  = new VisitRef(def2);

    expect(ref1a).toStrictEqual(ref1a);
    expect(ref1a).toStrictEqual(ref1b);
    expect(ref1a).not.toStrictEqual(ref2);
  });

  test('can use `expect().toStrictEqual()` to check the defs\' `value`', () => {
    const def1a = new VisitDef(1, 'boop');
    const def1b = new VisitDef(1, 'boop');
    const def2  = new VisitDef(1, 'zonkers');
    const ref1a = new VisitRef(def1a);
    const ref1b = new VisitRef(def1b);
    const ref2  = new VisitRef(def2);

    expect(ref1a).toStrictEqual(ref1a);
    expect(ref1a).toStrictEqual(ref1b);
    expect(ref1a).not.toStrictEqual(ref2);
  });
});
