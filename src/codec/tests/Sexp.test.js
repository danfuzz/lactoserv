// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/codec';
import { AskIf } from '@this/typey';


describe('constructor()', () => {
  test('does not throw given no args', () => {
    expect(() => new Sexp('x')).not.toThrow();
  });

  test('does not throw given one arg', () => {
    expect(() => new Sexp('x', 123)).not.toThrow();
  });

  test('produces a non-frozen instance', () => {
    expect(new Sexp(['y'])).not.toBeFrozen();
  });
});

describe('.functor', () => {
  test('is the `functor` passed in the constructor', () => {
    const func1 = ['a'];
    const func2 = { name: 'blort' };
    const func3 = 'stuff';

    expect(new Sexp(func1).functor).toBe(func1);
    expect(new Sexp(func2, 'yes').functor).toBe(func2);
    expect(new Sexp(func3, 123, true).functor).toBe(func3);
  });
});

describe('.functor =', () => {
  test('is disallowed on a frozen instance', () => {
    const sexp = new Sexp('boop');
    Object.freeze(sexp);
    expect(() => { sexp.functor = 'florp'; }).toThrow();
  });

  test('is allowed on a non-frozen instance, and affects the getter', () => {
    const sexp = new Sexp('boop');
    expect(() => { sexp.functor = 'florp'; }).not.toThrow();
    expect(sexp.functor).toBe('florp');
  });
});

describe('.args', () => {
  test('is an array', () => {
    expect(new Sexp('x').args).toBeArray();
    expect(new Sexp('x', 1).args).toBeArray();
  });

  test('is frozen', () => {
    expect(new Sexp('x', 'a', 'b').args).toBeFrozen();
    expect(new Sexp('x', 'a', 'b', 'c').args).toBeFrozen();
  });

  const argses = [
    true, null, undefined, 'x', 123, ['yes'], { no: 'maybe' }, new Map(),
    Symbol('blort'), 123456n, false, 456, 'whee', [], {}
  ];

  let argsAt = 0;
  for (let count = 0; count <= 15; count++) {
    const args = [];
    for (let i = 0; i < count; i++) {
      args.push(argses[argsAt]);
      argsAt = (argsAt + 1) % argsAt.length;
    }
    test(`works with ${count} argument(s)`, () => {
      const got = new Sexp('x', ...args).args;
      expect(got).toBeArray();
      expect(got).toBeFrozen();
      expect(got).toStrictEqual(args);
    });
  }
});

describe('.args =', () => {
  test('is disallowed on a frozen instance', () => {
    const sexp = new Sexp('boop');
    Object.freeze(sexp);
    expect(() => { sexp.args = [1, 2, 3]; }).toThrow();
  });

  test('throws if passed a non-array', () => {
    const sexp = new Sexp('boop');
    expect(() => { sexp.args = 'blorp'; }).toThrow();
  });

  test('is allowed on a non-frozen instance, and affects the getter', () => {
    const newArgs = [1, 2, 3];
    const sexp    = new Sexp('boop', 4, 5, 6);
    expect(() => { sexp.args = newArgs; }).not.toThrow();
    expect(sexp.args).toStrictEqual(newArgs);
    expect(sexp.args).not.toBe(newArgs);
    expect(sexp.args).toBeFrozen();
  });
});

describe('.toJSON()', () => {
  describe('with an at-string for `functor`', () => {
    test('does not include `args` when it is empty', () => {
      const sexp     = new Sexp('@x');
      const expected = { '@x': [] };

      expect(sexp.toJSON()).toEqual(expected);
    });

    test('includes non-empty `args`', () => {
      const sexp     = new Sexp('@x', 'a', 'b', 123);
      const expected = { '@x': ['a', 'b', 123] };

      expect(sexp.toJSON()).toEqual(expected);
    });
  });

  describe('with an arbitrary value (not otherwise covered) for `functor`', () => {
    test('includes just `functor` when `args` is empty', () => {
      const functor  = ['non', 'string', 'functor'];
      const sexp     = new Sexp(functor);
      const expected = { '@sexp': { functor } };

      expect(sexp.toJSON()).toEqual(expected);
    });

    test('includes `functor` and non-empty `args`', () => {
      const functor  = 12345;
      const sexp     = new Sexp(functor, 'a', 'b', 123);
      const expected = { '@sexp': { functor, args: ['a', 'b', 123] } };

      expect(sexp.toJSON()).toEqual(expected);
    });
  });

  test('prefixes a string functor with an at-sign if it doesn\'t already have one', () => {
    expect(new Sexp('florp').toJSON()).toEqual({ '@florp': [] });
  });

  test('converts a function functor (including a class) to its name with an at-prefix', () => {
    function florp() { return null; }

    expect(new Sexp(Map).toJSON()).toEqual({ '@Map': [] });
    expect(new Sexp(florp).toJSON()).toEqual({ '@florp': [] });
  });
});
