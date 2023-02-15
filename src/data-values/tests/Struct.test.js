// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Struct } from '@this/data-values';
import { AskIf } from '@this/typey';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new Struct('x', null)).not.toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Struct(['y'], {})).toBeFrozen();
  });
});

describe('.type', () => {
  test('is the `type` passed in the constructor', () => {
    const type1 = ['a'];
    const type2 = { name: 'blort' };
    const type3 = 'stuff';

    expect(new Struct(type1, {}).type).toBe(type1);
    expect(new Struct(type2, { a: 'boop' }, 'yes').type).toBe(type2);
    expect(new Struct(type3, null, 123, true).type).toBe(type3);
  });
});

describe('.args', () => {
  test('is an array', () => {
    expect(new Struct('x', null).args).toBeArray();
    expect(new Struct('x', {}, 1).args).toBeArray();
  });

  test('is frozen', () => {
    expect(new Struct('x', null, 'a', 'b').args).toBeFrozen();
    expect(new Struct('x', { y: null }, 'a', 'b', 'c').args).toBeFrozen();
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
      const got = new Struct('x', null, ...args).args;
      expect(got).toBeArray();
      expect(got).toBeFrozen();
      expect(got).toStrictEqual(args);
    });
  }
});

describe('.options', () => {
  test.each`
  opts
  ${null}
  ${{}}
  ${{ x: 10 }}
  ${new Map()}
  `('is a plain object, given $opts', ({ opts }) => {
    const struct = new Struct('x', opts);
    expect(struct.options).toBeObject();
    expect(AskIf.plainObject(struct.options)).toBeTrue();
  });

  test('is frozen', () => {
    expect(new Struct('x', null).options).toBeFrozen();
    expect(new Struct('x', { y: null }, 'a').options).toBeFrozen();
  });

  test('is the same object as passed in, if given a frozen plain object', () => {
    const opts = Object.freeze({ yes: 'indeed' });
    expect(new Struct('x', opts).options).toBe(opts);
  });

  test('is not the same object as passed in, if not given a plain object', () => {
    const opts = Object.freeze(new Map());
    expect(new Struct('x', opts).options).not.toBe(opts);
  });

  test('is not the same object as passed in, if not given a frozen object', () => {
    const opts = { no: 'siree' };
    expect(new Struct('x', opts).options).not.toBe(opts);
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
    const struct = new Struct('x', opts);
    expect(struct.options).toStrictEqual(expected);
  });
});
