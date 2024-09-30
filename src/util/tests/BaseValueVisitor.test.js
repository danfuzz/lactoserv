// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PromiseUtil } from '@this/async';
import { BaseValueVisitor } from '@this/util';


const RESOLVED_VALUE   = 'resolved-promise-value';
const REJECTED_ERROR   = new Error('from-a-promise');
const PENDING_PROMISE  = Promise.race([]);
const RESOLVED_PROMISE = Promise.resolve(RESOLVED_VALUE);
const REJECTED_PROMISE = Promise.reject(REJECTED_ERROR);
PromiseUtil.handleRejection(REJECTED_PROMISE);

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
    expect(() => new BaseValueVisitor(value)).not.toThrow();
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

  test('async-returns a resolved promise value', async () => {
    const vv  = new BaseValueVisitor(RESOLVED_PROMISE);
    const got = vv.visit();

    await expect(got).resolves.toBe(RESOLVED_VALUE);
  });

  test('async-rejects a rejected promise value', async () => {
    const vv  = new BaseValueVisitor(REJECTED_PROMISE);
    const got = vv.visit();

    await expect(got).rejects.toThrow(REJECTED_ERROR);
  });
});

describe('visitSync()', () => {
  test.each(EXAMPLES)('synchronously returns value as-is: %o', (value) => {
    const vv  = new BaseValueVisitor(value);
    const got = vv.visitSync();
    expect(got).toBe(value);
  });

  test.each([
    RESOLVED_PROMISE,
    REJECTED_PROMISE,
    PENDING_PROMISE
  ])('synchronously returns promise as-is: %o', (value) => {
    const vv  = new BaseValueVisitor(value);
    const got = vv.visitSync();
    expect(got).toBe(value);
  });
});

describe('visitWrap()', () => {
  test.each(EXAMPLES)('async-returns value as-is: %o', async (value) => {
    const vv      = new BaseValueVisitor(value);
    const gotProm = vv.visitWrap();
    expect(gotProm).toBeInstanceOf(Promise);

    const got = await gotProm;
    expect(got).toBeInstanceOf(BaseValueVisitor.WrappedResult);

    expect(got.value).toBe(value);
  });
});
