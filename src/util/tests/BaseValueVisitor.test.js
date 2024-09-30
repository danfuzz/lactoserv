// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseValueVisitor } from '@this/util';


const EXAMPLES = [
  undefined,
  null,
  true,
  123.456,
  567n,
  'blorp',
  Symbol('zonk'),
  ['yo', 'there'],
  { what: 'is up?' },
  new Set(['x', 'y', 'z'])
];

describe('constructor()', () => {
  test.each(EXAMPLES)('does not throw given value: %o', (value) => {
    expect(() => new BaseValueVisitor()).not.toThrow();
  });
});

describe('.value', () => {
  test('is the value passed into the constructor', () => {
    const value = ['yes', 'this', 'is', 'it'];
    const vv    = new BaseValueVisitor(value);
    expect(vv.value).toBe(value);
  });
});

describe('visit()', () => {
  test.each(EXAMPLES)('async-returns value as-is: %o', async (value) => {
    const vv  = new BaseValueVisitor(value);
    const got = vv.visit();
    expect(got).toBeInstanceOf(Promise);
    expect(await got).toBe(value);
  });
});

describe('visitSync()', () => {
  test.each(EXAMPLES)('synchronously returns value as-is: %o', (value) => {
    const vv  = new BaseValueVisitor(value);
    const got = vv.visitSync();
    expect(got).toBe(value);
  });
});
