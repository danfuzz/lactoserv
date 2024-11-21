// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/sexp';
import { VisitDef, VisitRef } from '@this/valvis';


describe('constructor()', () => {
  test('doesn\'t throw when not given a `value`', () => {
    expect(() => new VisitDef(0)).not.toThrow();
  });

  test('doesn\'t throw when given a `value`', () => {
    expect(() => new VisitDef(0, 'floomp')).not.toThrow();
  });

  test('treats an explicit `undefined` for `value` as `undefined` per se', () => {
    const def = new VisitDef(1, undefined);
    expect(def.isFinished()).toBeTrue();
    expect(def.value).toBeUndefined();
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

describe('deconstruct()', () => {
  test('works on an unfinished instance', () => {
    const def      = new VisitDef(1);
    const expected = new Sexp(VisitDef, 1);
    expect(def.deconstruct()).toStrictEqual(expected);
  });

  test('works on a (non-error) finished instance', () => {
    const def      = new VisitDef(2, 'beep');
    const expected = new Sexp(VisitDef, 2, 'beep');
    expect(def.deconstruct()).toStrictEqual(expected);
  });

  test('works on an error-finished instance when given `forLogging === true`', () => {
    const def      = new VisitDef(3);
    const error    = new Error('eeeek!');
    const expected = new Sexp(VisitDef, 3, 'error', error);
    def.finishWithError(error);
    expect(def.deconstruct(true)).toStrictEqual(expected);
  });

  test('throws on an error-finished instance when given `forLogging === false`', () => {
    const def   = new VisitDef(4);
    const error = new Error('eeeek!');
    def.finishWithError(error);
    expect(() => def.deconstruct()).toThrow();
  });
});

describe('isFinished()', () => {
  test('is `false` on an instance constructed without a value', () => {
    const def = new VisitDef(901);
    expect(def.isFinished()).toBeFalse();
  });

  test('is `true` on an instance constructed with a value', () => {
    const def = new VisitDef(902, 'bloop');
    expect(def.isFinished()).toBeTrue();
  });

  test('is `true` on an instance which became finished via `finishWithValue()`', () => {
    const def = new VisitDef(903);
    def.finishWithValue('bleep');
    expect(def.isFinished()).toBeTrue();
  });

  test('is `true` on an instance which became finished via `finishWithError()`', () => {
    const def = new VisitDef(904);
    def.finishWithError(new Error('oy!'));
    expect(def.isFinished()).toBeTrue();
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

// This validates that it's safe to use `expect(def).toStrictEqual(def)`
// in test cases throughout the system.
describe('validating Jest usage', () => {
  test('can use `expect().toStrictEqual()` to check `index`es', () => {
    const def1a = new VisitDef(1, 'boop');
    const def1b = new VisitDef(1, 'boop');
    const def2  = new VisitDef(2, 'boop');

    expect(def1a).toStrictEqual(def1a);
    expect(def1a).toStrictEqual(def1b);
    expect(def1a).not.toStrictEqual(def2);
  });

  test('can use `expect().toStrictEqual()` to check finished `value`s', () => {
    const def1a = new VisitDef(1, 'boop');
    const def1b = new VisitDef(1, 'boop');
    const def2  = new VisitDef(1, 'zonkers');
    const def3  = new VisitDef(1);

    expect(def1a).toStrictEqual(def1a);
    expect(def1a).toStrictEqual(def1b);
    expect(def1a).not.toStrictEqual(def2);
    expect(def1a).not.toStrictEqual(def3);
  });

  test('can use `expect().toStrictEqual()` to check finished `error`s', () => {
    const def1a = new VisitDef(1);
    const def1b = new VisitDef(1);
    const def2  = new VisitDef(1);
    const def3  = new VisitDef(1, 'good');

    const error1 = new Error('oy 1');
    def1a.finishWithError(error1);
    def1b.finishWithError(error1);
    def2.finishWithError(new Error('oy 2'));

    expect(def1a).toStrictEqual(def1a);
    expect(def1a).toStrictEqual(def1b);
    expect(def1a).not.toStrictEqual(def2);
    expect(def1a).not.toStrictEqual(def3);
  });
});
