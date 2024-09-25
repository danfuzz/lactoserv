// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/codec';
import { AskIf } from '@this/typey';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new Sexp('x', null)).not.toThrow();
  });

  test('produces a non-frozen instance', () => {
    expect(new Sexp(['y'], {})).not.toBeFrozen();
  });
});

describe('.functor', () => {
  test('is the `functor` passed in the constructor', () => {
    const func1 = ['a'];
    const func2 = { name: 'blort' };
    const func3 = 'stuff';

    expect(new Sexp(func1, {}).functor).toBe(func1);
    expect(new Sexp(func2, { a: 'boop' }, 'yes').functor).toBe(func2);
    expect(new Sexp(func3, null, 123, true).functor).toBe(func3);
  });
});

describe('.functor =', () => {
  test('is disallowed on a frozen instance', () => {
    const sexp = new Sexp('boop', null);
    Object.freeze(sexp);
    expect(() => { sexp.functor = 'florp'; }).toThrow();
  });

  test('is allowed on a non-frozen instance, and affects the getter', () => {
    const sexp = new Sexp('boop', null);
    expect(() => { sexp.functor = 'florp'; }).not.toThrow();
    expect(sexp.functor).toBe('florp');
  });
});

describe('.args', () => {
  test('is an array', () => {
    expect(new Sexp('x', null).args).toBeArray();
    expect(new Sexp('x', {}, 1).args).toBeArray();
  });

  test('is frozen', () => {
    expect(new Sexp('x', null, 'a', 'b').args).toBeFrozen();
    expect(new Sexp('x', { y: null }, 'a', 'b', 'c').args).toBeFrozen();
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
      const got = new Sexp('x', null, ...args).args;
      expect(got).toBeArray();
      expect(got).toBeFrozen();
      expect(got).toStrictEqual(args);
    });
  }
});

describe('.args =', () => {
  test('is disallowed on a frozen instance', () => {
    const sexp = new Sexp('boop', null);
    Object.freeze(sexp);
    expect(() => { sexp.args = [1, 2, 3]; }).toThrow();
  });

  test('throws if passed a non-array', () => {
    const sexp = new Sexp('boop', null);
    expect(() => { sexp.args = 'blorp'; }).toThrow();
  });

  test('is allowed on a non-frozen instance, and affects the getter', () => {
    const newArgs = [1, 2, 3];
    const sexp    = new Sexp('boop', null, 4, 5, 6);
    expect(() => { sexp.args = newArgs; }).not.toThrow();
    expect(sexp.args).toStrictEqual(newArgs);
    expect(sexp.args).not.toBe(newArgs);
    expect(sexp.args).toBeFrozen();
  });
});

describe('.options', () => {
  test.each`
  opts
  ${null}
  ${{}}
  ${{ x: 10 }}
  ${new Map()}
  `('is a plain object, given $opts', ({ opts }) => {
    const sexp = new Sexp('x', opts);
    expect(sexp.options).toBeObject();
    expect(AskIf.plainObject(sexp.options)).toBeTrue();
  });

  test('is frozen', () => {
    expect(new Sexp('x', null).options).toBeFrozen();
    expect(new Sexp('x', { y: null }, 'a').options).toBeFrozen();
  });

  test('is the same object as passed in, if given a frozen plain object', () => {
    const opts = Object.freeze({ yes: 'indeed' });
    expect(new Sexp('x', opts).options).toBe(opts);
  });

  test('is not the same object as passed in, if not given a plain object', () => {
    const opts = Object.freeze(new Map());
    expect(new Sexp('x', opts).options).not.toBe(opts);
  });

  test('is not the same object as passed in, if not given a frozen object', () => {
    const opts = { no: 'siree' };
    expect(new Sexp('x', opts).options).not.toBe(opts);
  });

  const extraProps = new Set();
  extraProps.whee = 'yay';

  test.each`
  label                                  | opts          | expected
  ${'null'}                              | ${null}       | ${{}}
  ${'{}'}                                | ${{}}         | ${{}}
  ${'{ x: 10 }'}                         | ${{ x: 10 }}  | ${{ x: 10 }}
  ${'instance with no extra properties'} | ${new Map()}  | ${{}}
  ${'instance with extra properties'}    | ${extraProps} | ${{ whee: 'yay' }}
  `('converts $label as expected', ({ opts, expected }) => {
    const sexp = new Sexp('x', opts);
    expect(sexp.options).toStrictEqual(expected);
  });
});

describe('.options =', () => {
  test('is disallowed on a frozen instance', () => {
    const sexp = new Sexp('boop', null);
    Object.freeze(sexp);
    expect(() => { sexp.options = { a: 10 }; }).toThrow();
  });

  test('is allowed on a non-frozen instance, and affects the getter', () => {
    const newOpts = { a: 10, b: 20 };
    const sexp    = new Sexp('boop', { c: 30 }, 123);
    expect(() => { sexp.options = newOpts; }).not.toThrow();
    expect(sexp.options).toStrictEqual(newOpts);
    expect(sexp.options).not.toBe(newOpts);
    expect(sexp.options).toBeFrozen();
  });
});

describe('.toJSON()', () => {
  describe('with an at-string for `functor`', () => {
    test('includes neither `args` nor `options` when both are empty', () => {
      const sexp1    = new Sexp('@x', null);
      const sexp2    = new Sexp('@x', {});
      const sexp3    = new Sexp('@x');
      const expected = { '@x': {} };

      expect(sexp1.toJSON()).toEqual(expected);
      expect(sexp2.toJSON()).toEqual(expected);
      expect(sexp3.toJSON()).toEqual(expected);
    });

    test('includes just non-empty `options` when `args` is empty', () => {
      const sexp     = new Sexp('@x', { a: 12 });
      const expected = { '@x': { a: 12 } };

      expect(sexp.toJSON()).toEqual(expected);
    });

    test('includes just non-empty `args` when `options` is empty', () => {
      const sexp     = new Sexp('@x', null, 'a', 'b', 123);
      const expected = { '@x': ['a', 'b', 123] };

      expect(sexp.toJSON()).toEqual(expected);
    });

    test('includes a sub-object with both `args` and `options` when both are non-empty', () => {
      const sexp     = new Sexp('@x', { xyz: true }, 'a', 'b', 123);
      const expected = { '@x': { args: ['a', 'b', 123], options: { xyz: true } } };

      expect(sexp.toJSON()).toEqual(expected);
    });
  });

  describe('with an arbitrary value (not otherwise covered) for `functor`', () => {
    test('includes just `functor` when both `args` and `options` are empty', () => {
      const functor  = ['non', 'string', 'functor'];
      const sexp1    = new Sexp(functor, null);
      const sexp2    = new Sexp(functor, {});
      const sexp3    = new Sexp(functor);
      const expected = { '@sexp': { functor } };

      expect(sexp1.toJSON()).toEqual(expected);
      expect(sexp2.toJSON()).toEqual(expected);
      expect(sexp3.toJSON()).toEqual(expected);
    });

    test('includes just `functor` and non-empty `options` when `args` is empty', () => {
      const functor  = false;
      const sexp     = new Sexp(functor, { a: 12 });
      const expected = { '@sexp': { functor, options: { a: 12 } } };

      expect(sexp.toJSON()).toEqual(expected);
    });

    test('includes just `functor` and non-empty `args` when `options` is empty', () => {
      const functor  = 12345;
      const sexp     = new Sexp(functor, null, 'a', 'b', 123);
      const expected = { '@sexp': { functor, args: ['a', 'b', 123] } };

      expect(sexp.toJSON()).toEqual(expected);
    });

    test('includes a sub-object with all bits when both `args` and `options` are non-empty', () => {
      const functor  = { zoiks: 'a-functor' };
      const sexp     = new Sexp(functor, { xyz: true }, 'a', 'b', 123);
      const expected = { '@sexp': { functor, args: ['a', 'b', 123], options: { xyz: true } } };

      expect(sexp.toJSON()).toEqual(expected);
    });
  });

  test('prefixes a string functor with an at-sign if it doesn\'t already have one', () => {
    expect(new Sexp('florp').toJSON()).toEqual({ '@florp': {} });
  });

  test('converts a function functor (including a class) to its name with an at-prefix', () => {
    function florp() { return null; }

    expect(new Sexp(Map).toJSON()).toEqual({ '@Map': {} });
    expect(new Sexp(florp).toJSON()).toEqual({ '@florp': {} });
  });
});
