// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/sexp';


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

describe('.functorName', () => {
  test('is `.functor` if it is a string', () => {
    const expected = 'bloop';
    expect(new Sexp(expected, 1, 2, 3).functorName).toBe(expected);
  });

  test('is `.functor.name` if it is a non-empty string', () => {
    const expected = 'bloop';
    expect(new Sexp({ name: expected }, 1, 2, 3).functorName).toBe(expected);
  });

  test('is the function name if `.functor` is a function', () => {
    function florp() { return null; }
    expect(new Sexp(florp, 1, 2, 3).functorName).toBe('florp');
  });

  test('is the class name if `.functor` is a class', () => {
    class Zonk { /*empty*/ }
    expect(new Sexp(Zonk, 1, 2, 3).functorName).toBe('Zonk');
  });

  test('is `<anonymous>` given the empty string for `.functor`', () => {
    expect(new Sexp('', []).functorName).toBe('<anonymous>');
  });

  test.each`
  value
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${123n}
  ${Symbol('boop')}
  ${{ a: 123 }}
  ${['beep', 'boop']}
  ${new Set('x')}
  `('is `<anonymous>` given `$value` for `.functor`', ({ value }) => {
    expect(new Sexp(value, 'boop').functorName).toBe('<anonymous>');
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

describe('[Symbol.iterator]()', () => {
  test.each`
  label                   | expected
  ${'a no-arg instance'}  | ${['blorp']}
  ${'a one-arg instance'} | ${['bonk', 5]}
  ${'a two-arg instance'} | ${[Set, 123n, false]}
  `('works with $label', ({ expected }) => {
    const sexp = new Sexp(...expected);
    let   at   = 0;

    for (const got of sexp) {
      expect(got).toStrictEqual(expected[at]);
      at++;
    }

    expect(at).toBe(expected.length);
  });

  test('uses the `args` from the moment of iteration', () => {
    const expected = ['blorp', 5, 4, 3, 2, 1];
    const sexp     = new Sexp(...expected);
    const got      = sexp[Symbol.iterator]();

    expect(got.next()).toStrictEqual({ done: false, value: expected[0] });

    sexp.args = ['eep', 'oop'];

    expect([...got]).toStrictEqual(expected.slice(1));
  });
});

describe('.toArray()', () => {
  test.each`
  label                   | expected
  ${'a no-arg instance'}  | ${['blorp']}
  ${'a one-arg instance'} | ${['bonk', 5]}
  ${'a two-arg instance'} | ${[Set, 123n, false]}
  `('works with $label', ({ expected }) => {
    const sexp = new Sexp(...expected);
    expect(sexp.toArray()).toStrictEqual(expected);
  });
});
