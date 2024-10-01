// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { ManualPromise, PromiseState, PromiseUtil } from '@this/async';
import { BaseValueVisitor } from '@this/util';


const RESOLVED_VALUE   = 'resolved-promise-value';
const REJECTED_ERROR   = new Error('from-a-promise');
const PENDING_PROMISE  = Promise.race([]);
const RESOLVED_PROMISE = Promise.resolve(RESOLVED_VALUE);
const REJECTED_PROMISE = Promise.reject(REJECTED_ERROR);

REJECTED_ERROR.stack = 'some-stack';
PromiseUtil.handleRejection(REJECTED_PROMISE);

const OBJECT_PROXY   = new Proxy({ a: 'florp' }, {});
const FUNCTION_PROXY = new Proxy(() => 123, {});

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
  new Set(['x', 'y', 'z']),
  (x, y) => { return x < y; },
  class Flomp { /*empty*/ },
  OBJECT_PROXY,
  FUNCTION_PROXY
];

/**
 * Visitor subclass, with some synchronous and some asynchronous behavior.
 */
class SubVisit extends BaseValueVisitor {
  _impl_visitBigInt(node_unused) {
    throw new Error('Nope!');
  }

  async _impl_visitBoolean(node) {
    await setImmediate();
    return `${node}`;
  }

  _impl_visitNumber(node) {
    return `${node}`;
  }

  async _impl_visitSymbol(node_unused) {
    throw new Error('NO');
  }

  _impl_visitArray(node) {
    return this._prot_visitArrayProperties(node);
  }

  _impl_visitPlainObject(node) {
    return this._prot_visitObjectProperties(node);
  }
}

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

  test('plumbs through a resolved promise value', async () => {
    const vv  = new BaseValueVisitor(RESOLVED_PROMISE);
    const got = vv.visit();

    await expect(got).resolves.toBe(RESOLVED_VALUE);
  });

  test('plumbs through a rejected promise value', async () => {
    const vv  = new BaseValueVisitor(REJECTED_PROMISE);
    const got = vv.visit();

    await expect(got).rejects.toThrow(REJECTED_ERROR);
  });

  test('plumbs through a pending promise', async () => {
    const mp  = new ManualPromise();
    const vv  = new BaseValueVisitor(mp.promise);
    const got = vv.visit();

    await setImmediate();
    expect(PromiseState.isPending(got)).toBeTrue();

    mp.resolve('zonk');

    await setImmediate();
    expect(PromiseState.isFulfilled(got)).toBeTrue();
    expect(await got).toBe('zonk');
  });

  test('throws the error which was thrown synchronously by an `_impl_visit*()` method', async () => {
    const vv  = new SubVisit(123n);
    const got = vv.visit();

    await expect(got).rejects.toThrow('Nope!');
  });

  test('throws the error which was thrown asynchronously by an `_impl_visit*()` method', async () => {
    const vv  = new SubVisit(Symbol('eep'));
    const got = vv.visit();

    await expect(got).rejects.toThrow('NO');
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

  test('throws the error which was thrown synchronously by an `_impl_visit*()` method', () => {
    const vv = new SubVisit(123n);
    expect(() => vv.visitSync()).toThrow('Nope!');
  });

  test('throws the right error if the visit did not complete synchronously', () => {
    const vv = new SubVisit(true);
    expect(() => vv.visitSync()).toThrow('Visit did not complete synchronously.');
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

  test.each([
    RESOLVED_PROMISE,
    REJECTED_PROMISE,
    PENDING_PROMISE
  ])('async-returns promise as-is: %o', async (value) => {
    const vv      = new BaseValueVisitor(value);
    const gotProm = vv.visitWrap();
    expect(gotProm).toBeInstanceOf(Promise);

    const got = await gotProm;
    expect(got).toBeInstanceOf(BaseValueVisitor.WrappedResult);

    expect(got.value).toBe(value);
  });

  test('throws the error which was thrown synchronously by an `_impl_visit*()` method', async () => {
    const vv  = new SubVisit(123n);
    const got = vv.visitWrap();

    await expect(got).rejects.toThrow('Nope!');
  });

  test('throws the error which was thrown asynchronously by an `_impl_visit*()` method', async () => {
    const vv  = new SubVisit(Symbol('eep'));
    const got = vv.visitWrap();

    await expect(got).rejects.toThrow('NO');
  });
});

describe('_prot_visitArrayProperties()', () => {
  test('operates synchronously when possible', () => {
    const orig = [1, 2];
    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();

    expect(got).toEqual(['1', '2']);
  });

  test('operates synchronously when possible, and recursively', () => {
    const orig = [1, 2, [3, 4], 5];
    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();

    expect(got).toEqual(['1', '2', ['3', '4'], '5']);
  });

  test('operates asynchronously', async () => {
    const orig = [false, true];
    const vv   = new SubVisit(orig);
    const got  = await vv.visit();

    expect(got).toEqual(['false', 'true']);
  });

  test('operates asynchronously and recursively', async () => {
    const orig = [false, 1, [true, 2], false];
    const vv   = new SubVisit(orig);
    const got  = await vv.visit();

    expect(got).toEqual(['false', '1', ['true', '2'], 'false']);
  });

  test('synchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new SubVisit([456n]);

    expect(() => vv.visitSync()).toThrow('Nope!');
  });

  test('preserves sparseness', () => {
    const UND  = undefined;
    const orig = Array(7);

    orig[2] = 'x';
    orig[4] = 'y';
    orig[5] = 5;

    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();

    expect(got).toEqual([UND, UND, 'x', UND, 'y', '5', UND]);
    for (let i = 0; i < 10; i++) {
      expect(i in got).toBe(i in orig);
    }
  });

  test('handles non-numeric string properties', () => {
    const orig = [1];
    orig.x = 2;
    orig.y = 3;

    const expected = ['1'];
    expected.x = '2';
    expected.y = '3';

    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();
    expect(got).toEqual(expected);
  });

  test('handles synchronously-visitable symbol properties', () => {
    const SYM1 = Symbol.for('x');
    const SYM2 = Symbol('y');
    const orig = [123];
    orig[SYM1] = 234;
    orig[SYM2] = 321;

    const expected = ['123'];
    expected[SYM1] = '234';
    expected[SYM2] = '321';

    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();
    expect(got).toBeArrayOfSize(1);
    expect(got[0]).toBe('123');
    expect(got[SYM1]).toBe('234');
    expect(got[SYM2]).toBe('321');
  });

  test('handles asynchronously-visitable symbol properties', async () => {
    const SYM1 = Symbol.for('x');
    const SYM2 = Symbol('y');
    const orig = [123];
    orig[SYM1] = true;
    orig[SYM2] = false;

    const expected = ['123'];
    expected[SYM1] = 'true';
    expected[SYM2] = 'false';

    const vv   = new SubVisit(orig);
    const got  = await vv.visit();
    expect(got).toBeArrayOfSize(1);
    expect(got[0]).toBe('123');
    expect(got[SYM1]).toBe('true');
    expect(got[SYM2]).toBe('false');
  });
});

describe('_prot_visitObjectProperties()', () => {
  test('operates synchronously when possible', () => {
    const orig = { a: 10, b: 20 };
    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();

    expect(got).toEqual({ a: '10', b: '20' });
  });

  test('operates synchronously when possible, and recursively', () => {
    const orig = { a: 1, b: 2, c: { d: 3, e: 4 }, f: 5 };
    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();

    expect(got).toEqual({ a: '1', b: '2',  c: { d: '3', e: '4' }, f: '5' });
  });

  test('operates asynchronously', async () => {
    const orig = { x: false, y: true };
    const vv   = new SubVisit(orig);
    const got  = await vv.visit();

    expect(got).toEqual({ x: 'false', y: 'true' });
  });

  test('operates asynchronously and recursively', async () => {
    const orig = { x: false, y: 1, z: { a: true, b: 2 } };
    const vv   = new SubVisit(orig);
    const got  = await vv.visit();

    expect(got).toEqual({ x: 'false', y: '1', z: { a: 'true', b: '2' } });
  });

  test('synchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new SubVisit({ blorp: 456n });

    expect(() => vv.visitSync()).toThrow('Nope!');
  });

  test('handles symbol properties', () => {
    const SYM1 = Symbol.for('x');
    const SYM2 = Symbol('y');
    const orig = {
      [SYM1]: 234,
      [SYM2]: 321
    };

    const vv   = new SubVisit(orig);
    const got  = vv.visitSync();
    expect(got).toBeObject();
    expect(got[SYM1]).toBe('234');
    expect(got[SYM2]).toBe('321');
  });
});
