// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { LoggedValueEncoder } from '@this/loggy-intf';
import { Sexp } from '@this/sexp';

function nullOutObjectPrototypes(value) {
  if (!(value && (typeof value === 'object'))) {
    return value;
  } else if (Array.isArray(value)) {
    const result = [];
    for (const v of value) {
      result.push(nullOutObjectPrototypes(v));
    }
    return result;
  } else if (Reflect.getPrototypeOf(value) === Object.prototype) {
    const result = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      result[k] = nullOutObjectPrototypes(v);
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
    const expected = nullOutObjectPrototypes(value);
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
  ${new Map()}           | ${sexp('Map', '...')}
  ${new Proxy({}, {})}   | ${sexp('Proxy', '<anonymous>')}
  ${new Proxy([], {})}   | ${sexp('Proxy', '<anonymous>')}
  ${new Proxy(new SomeClass(), {})} | ${sexp('Proxy', '<anonymous>')}
  ${new Proxy(someFunc, {})} | ${sexp('Proxy', 'someFunc')}
  `('($#) correctly encodes $value', ({ value, expected }) => {
    const got = LoggedValueEncoder.encode(value);
    expect(got).toStrictEqual(expected);
  });
});
