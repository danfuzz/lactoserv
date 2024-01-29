// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HttpHeaders } from '@this/net-util';

describe('constructor', () => {
  describe('given no arguments', () => {
    test('doesn\'t throw', () => {
      expect(() => new HttpHeaders()).not.toThrow();
    });

    test('constructs a subclass of `Headers`', () => {
      expect(new HttpHeaders()).toBeInstanceOf(Headers);
    });

    test('has no entries', () => {
      const hh = new HttpHeaders();
      expect([...hh]).toEqual([]);
    });
  });
});

describe.each`
label            | constructor
${'constructor'} | ${true}
${'appendAll()'} | ${false}
`('$label', ({ constructor }) => {
  function prep(arg) {
    if (constructor) {
      return new HttpHeaders(arg);
    } else {
      const hh = new HttpHeaders();
      hh.appendAll(arg);
      return hh;
    }
  }

  const aPlainObj1 = { foo: 'bar', 'florp': ['um', 'yeah'] };
  const aMap1      = new Map([['foo', 'bar'], ['florp', 'um, yeah']]);
  const aHeaders1  = new Headers();
  const anotherHH1 = new HttpHeaders();

  aHeaders1.append('foo', 'bar');
  aHeaders1.append('florp', 'um');
  aHeaders1.append('florp', 'yeah');

  anotherHH1.append('foo', 'bar');
  anotherHH1.append('florp', 'um');
  anotherHH1.append('florp', 'yeah');

  const aPlainObj2 = { 'set-cookie': ['x=1', 'y=2'] };
  const aMap2      = new Map([['set-cookie', ['x=1', 'y=2']]]);
  const aHeaders2  = new Headers();
  const anotherHH2 = new HttpHeaders();

  aHeaders2.append('set-cookie', 'x=1');
  aHeaders2.append('set-cookie', 'y=2');

  anotherHH2.append('set-cookie', 'x=1');
  anotherHH2.append('set-cookie', 'y=2');

  describe.each`
  label                      | arg1          | arg2
  ${'a plain object'}        | ${aPlainObj1} | ${aPlainObj2}
  ${'a Map'}                 | ${aMap1}      | ${aMap2}
  ${'a `Headers` per se'}    | ${aHeaders1}  | ${aHeaders2}
  ${'another `HttpHeaders`'} | ${anotherHH1} | ${anotherHH2}
  `('given $label', ({ arg1, arg2 }) => {
    test('includes its elements', () => {
      const hh = prep(arg1);
      expect([...hh]).toIncludeSameMembers([['foo', 'bar'], ['florp', 'um, yeah']]);
    });

    test('works given multiple `set-cookie`s', () => {
      const hh = prep(arg2);
      expect([...hh]).toEqual([['set-cookie', 'x=1'], ['set-cookie', 'y=2']]);
      expect(hh.getSetCookie()).toIncludeSameMembers(['x=1', 'y=2']);
    });
  });
});

describe('appendAll()', () => {
  test('sets a non-existent name to a single given value', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.appendAll({ 'x': 'y' });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y']]);
  });

  test('sets a non-existent name to multiple given values', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.appendAll({ 'x': ['y', 'z'] });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y, z']]);
  });

  test('appends a single value to a pre-existing name', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.set('x', 'y');
    hh.appendAll({ 'x': 'z' });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y, z']]);
  });

  test('appends multiple values to a pre-existing name', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.set('x', 'y');
    hh.append('x', 'z');
    hh.appendAll({ 'x': ['z1', 'z2'] });

    expect([...hh]).toIncludeSameMembers([
      ['a', 'b'], ['x', 'y, z, z1, z2']
    ]);
  });

  test('appends multiple `set-cookies` from a plain object', () => {
    const hh = new HttpHeaders();

    hh.set('set-cookie', 'a=1');
    hh.appendAll({ 'set-cookie': ['b=2', 'c=3'] });

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'a=1'],
      ['set-cookie', 'b=2'],
      ['set-cookie', 'c=3']
    ]);
  });

  test('appends multiple `set-cookies` from a `Headers`', () => {
    const hh = new HttpHeaders();
    const orig = new Headers();

    hh.set('set-cookie', 'a=1');
    orig.append('set-cookie', 'b=2');
    orig.append('set-cookie', 'c=3');
    hh.appendAll(orig);

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'a=1'],
      ['set-cookie', 'b=2'],
      ['set-cookie', 'c=3']
    ]);
  });
});

// TODO: `extract()`
