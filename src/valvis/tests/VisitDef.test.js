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
    const def = new VisitDef(3);
    expect(() => def.value).toThrow(/Not yet finished./);
  });

  test('throws the error set by `finishWithError()`', () => {
    const def = new VisitDef(4);
    const err = new Error('Nope!');

    def.finishWithError(err);
    expect(() => def.value).toThrow(err);
  });
});

describe.each`
methodName           | arg
${'finishWithError'} | ${new Error('Eek!')}
${'finishWithValue'} | ${'florp'}
`('$methodName()', ({ methodName, arg }) => {
  test('does not throw, given an unfinished instance', () => {
    const def = new VisitDef(1);
    expect(() => def[methodName](arg)).not.toThrow();
  });

  test('throws given an instance that was constructed with a value', () => {
    const def = new VisitDef(2, 999);
    expect(() => def[methodName](arg)).toThrow(/Already finished/);
  });

  test('throws given an instance upon which `finishWithValue()` was called', () => {
    const def = new VisitDef(3);

    def.finishWithValue('x');
    expect(() => def[methodName](arg)).toThrow(/Already finished/);
  });

  test('throws given an instance upon which `finishWithError()` was called', () => {
    const def = new VisitDef(4);

    def.finishWithValue('x');
    expect(() => def[methodName](arg)).toThrow(/Already finished/);
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement for a value-bearing instance', () => {
    const def = new VisitDef(20, 'bongo');
    expect(def.toJSON()).toStrictEqual({ '@def': [20, 'bongo'] });
  });

  test('returns the expected replacement for an unfinished instance', () => {
    const def = new VisitDef(21);
    expect(def.toJSON()).toStrictEqual({ '@def': [21] });
  });

  test('returns the expected replacement for an errored instance', () => {
    const def = new VisitDef(22);

    def.finishWithError(new Error('Eek!'));
    expect(def.toJSON()).toStrictEqual({ '@def': [22, null, 'Eek!'] });
  });
});
