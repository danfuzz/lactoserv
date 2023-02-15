// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Struct } from '@this/data-values';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new Struct('x')).not.toThrow();
  });

  test('produces a frozen instance', () => {
    expect(new Struct(['y'])).toBeFrozen();
  });
});

describe('.type', () => {
  test('is the `type` passed in the constructor', () => {
    const type1 = ['a'];
    const type2 = { name: 'blort' };
    const type3 = 'stuff';

    expect(new Struct(type1).type).toBe(type1);
    expect(new Struct(type2, 'yes').type).toBe(type2);
    expect(new Struct(type3, 123, true).type).toBe(type3);
  });
});

describe('.args', () => {
  test('is an array', () => {
    expect(new Struct('x').args).toBeArray();
    expect(new Struct('x', 1).args).toBeArray();
  });

  test('is frozen', () => {
    expect(new Struct('x', 'a', 'b').args).toBeFrozen();
    expect(new Struct('x', 'a', 'b', 'c').args).toBeFrozen();
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
      const got = new Struct('x', ...args).args;
      expect(got).toBeArray();
      expect(got).toBeFrozen();
      expect(got).toStrictEqual(args);
    });
  }
});
