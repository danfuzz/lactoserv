// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration } from '@this/quant';
import { LoggedValueEncoder } from '@this/loggy-intf';
import { Sexp } from '@this/sexp';
import { VisitDef, VisitRef } from '@this/valvis';

function withNullObjectProtos(value) {
  if (!(value && (typeof value === 'object'))) {
    return value;
  } else if (Array.isArray(value)) {
    const result = [];
    for (const v of value) {
      result.push(withNullObjectProtos(v));
    }
    return result;
  } else if (Reflect.getPrototypeOf(value) === Object.prototype) {
    const result = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      result[k] = withNullObjectProtos(v);
    }
    return result;
  } else {
    return value;
  }
}

function sexp(type, ...args) {
  return new Sexp(type, ...args);
}

describe('encode()', () => {
  // Cases where the result should be equal to the input.
  test.each`
  value
  ${null}
  ${false}
  ${true}
  ${'florp'}
  ${123.456}
  ${[]}
  ${[1, 2, 3, 'four']}
  ${[[null], [false], [[55]]]}
  `('($#) self-encodes $value', ({ value }) => {
    const got = LoggedValueEncoder.encode(value);
    expect(got).toStrictEqual(value);
  });

  // Plain objects are expected to get converted to null-prototype objects.
  test.each`
  value
  ${{}}
  ${{ a: 10, b: 'twenty' }}
  ${{ abc: { x: [{ d: 'efg' }] } }}
  `('($#) self-encodes $value except with a `null` object prototypes', ({ value }) => {
    const got = LoggedValueEncoder.encode(value);
    const expected = withNullObjectProtos(value);
    expect(got).toStrictEqual(expected);
  });

  class SomeClass {
    // @defaultConstructor
  }

  const someFunc = () => null;

  // Stuff that isn't JSON-encodable should end up in the form of a sexp.
  test.each`
  value                  | expected
  ${undefined}           | ${sexp('Undefined')}}
  ${[undefined]}         | ${[sexp('Undefined')]}}
  ${321123n}             | ${sexp('BigInt', '321123')}}
  ${Symbol('xyz')}       | ${sexp('Symbol', 'xyz')}}
  ${Symbol.for('blorp')} | ${sexp('Symbol', 'blorp', true)}}
  ${new Duration(12.34)} | ${sexp('Duration', 12.34, '12.340 sec')}
  ${new Map()}           | ${sexp('Map', '...')}
  ${new Proxy({}, {})}   | ${sexp('Proxy', '<anonymous>')}
  ${new Proxy([], {})}   | ${sexp('Proxy', '<anonymous>')}
  ${new Proxy(new SomeClass(), {})} | ${sexp('Proxy', '<anonymous>')}
  ${new Proxy(someFunc, {})} | ${sexp('Proxy', 'someFunc')}
  `('($#) correctly encodes $value', ({ value, expected }) => {
    const got = LoggedValueEncoder.encode(value);
    expect(got).toStrictEqual(expected);
  });

  test('does not def-ref a small-enough array', () => {
    const value = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const got   = LoggedValueEncoder.encode([value, value]);
    expect(got).toStrictEqual([value, value]);
  });

  test('does not def-ref a small-enough plain object', () => {
    const value    = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 };
    const expected = withNullObjectProtos(value);
    const got      = LoggedValueEncoder.encode([value, value]);
    expect(got).toStrictEqual([expected, expected]);
  });

  test('def-refs a large-enough array', () => {
    const value    = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const def      = new VisitDef(0, value);
    const expected = [def, new VisitRef(def)];
    const got      = LoggedValueEncoder.encode([value, value]);
    expect(got).toStrictEqual(expected);
  });

  test('def-refs a large-enough plain object', () => {
    const value    = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11 };
    const def      = new VisitDef(0, value);
    const expected = [def, new VisitRef(def)];
    const got      = LoggedValueEncoder.encode([value, value]);
    expect(got).toStrictEqual(expected);
  });

  test('def-refs the sexp from an instance', () => {

  });
});
