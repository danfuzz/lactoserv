// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { ManualPromise, PromiseState, PromiseUtil } from '@this/async';
import { BaseValueVisitor, VisitResult } from '@this/util';


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
  class Flomp { /*empty*/ }
];

const OBJECT_PROXY   = new Proxy({ a: 'florp' }, {});
const FUNCTION_PROXY = new Proxy(() => 123, {});
const CLASS_PROXY    = new Proxy(class Florp {}, {});
const ARRAY_PROXY    = new Proxy(['array'], {});
const PROXY_EXAMPLES = [
  OBJECT_PROXY,
  FUNCTION_PROXY,
  CLASS_PROXY,
  ARRAY_PROXY
];

const RESOLVED_VALUE   = 'resolved-promise-value';
const REJECTED_ERROR   = new Error('from-a-promise');
const PENDING_PROMISE  = Promise.race([]);
const RESOLVED_PROMISE = Promise.resolve(RESOLVED_VALUE);
const REJECTED_PROMISE = Promise.reject(REJECTED_ERROR);

REJECTED_ERROR.stack = 'some-stack';
PromiseUtil.handleRejection(REJECTED_PROMISE);

const PROMISE_EXAMPLES = [
  PENDING_PROMISE,
  RESOLVED_PROMISE,
  REJECTED_PROMISE
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
    await setImmediate();
    throw new Error('NO');
  }

  _impl_visitArray(node) {
    return this._prot_visitArrayProperties(node);
  }

  _impl_visitPlainObject(node) {
    return this._prot_visitObjectProperties(node);
  }
}

/**
 * Visitor subclass, which is set up to be proxy aware.
 */
class ProxyAwareVisitor extends BaseValueVisitor {
  _impl_isProxyAware() {
    return true;
  }

  _impl_visitProxy(node) {
    return { proxy: node };
  }
}

describe('constructor()', () => {
  const CASES = [...EXAMPLES, ...PROXY_EXAMPLES, ...PROMISE_EXAMPLES];
  test.each(CASES)('does not throw given value: %o', (value) => {
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

// Tests for all three `visit*()` methods.
describe.each`
methodName     | isAsync  | wraps    | canReturnPromises
${'visit'}     | ${true}  | ${false} | ${false}
${'visitSync'} | ${false} | ${false} | ${true}
${'visitWrap'} | ${true}  | ${true}  | ${true}
`('$methodName()', ({ methodName, isAsync, wraps, canReturnPromises }) => {
  const CIRCULAR_MSG = 'Visit is deadlocked due to circular reference.';

  async function doTest(value, options = {}) {
    const {
      cls = BaseValueVisitor,
      check = (got) => { expect(got).toBe(value); }
    } = options;

    const visitor = new cls(value);

    if (isAsync) {
      const got = visitor[methodName]();
      expect(got).toBeInstanceOf(Promise);
      if (wraps) {
        const wrapper = await got;
        expect(wrapper).toBeInstanceOf(VisitResult);
        check(wrapper.value);
      } else {
        check(await got);
      }
    } else {
      check(visitor[methodName]());
    }
  }

  test.each(EXAMPLES)('returns the given value as-is: %o', async (value) => {
    await doTest(value);
  });

  test('throws the right error if given a value whose synchronous visit directly encountered a circular reference', async () => {
    const circ1 = [4];
    const circ2 = [5, 6, circ1];
    const value = [1, [2, 3, circ1]];

    circ1.push(circ2);

    await expect(doTest(value, { cls: SubVisit })).rejects.toThrow(CIRCULAR_MSG);
  });

  if (isAsync) {
    test('returns the value which was returned asynchronously by an `_impl_visit*()` method', async () => {
      const value = true;
      await doTest(value, {
        cls: SubVisit,
        check: (got) => {
          expect(got).toBe('true');
        }
      });
    });

    test('throws the error which was thrown asynchronously by an `_impl_visit*()` method', async () => {
      const value = Symbol('eep');
      await expect(doTest(value, { cls: SubVisit })).rejects.toThrow('NO');
    });

    test('throws the right error if given a value whose asynchronous visit would directly contain a circular reference', async () => {
      const circ1 = [true, 4];
      const circ2 = [true, 5, 6, circ1];
      const value = [true, 1, [2, 3, circ1]];

      circ1.push(circ2);

      await expect(doTest(value, { cls: SubVisit })).rejects.toThrow(CIRCULAR_MSG);
    });

    test.skip('throws the right error if given a value whose asynchronous visit would directly contain a circular reference (even more async)', async () => {
      class ExtraAsyncVisitor extends SubVisit {
        async _impl_visitArray(node) {
          await setImmediate();
          return this._prot_visitArrayProperties(node);
        }
      }

      const circ1 = [true, 4];
      const circ2 = [true, 5, 6, circ1];
      const value = [true, 1, [2, 3, circ1]];

      circ1.push(circ2);

      await expect(doTest(value, { cls: ExtraAsyncVisitor })).rejects.toThrow(CIRCULAR_MSG);
    });
  } else {
    const MSG = 'Visit did not finish synchronously.';

    test('throws the right error if a will-be-successful visit did not finish synchronously', async () => {
      const value = true;
      await expect(doTest(value, { cls: SubVisit })).rejects.toThrow(MSG);
    });

    test('throws the right error if a will-fail visit did not finish synchronously', async () => {
      const value = Symbol('eeeeek');
      await expect(doTest(value, { cls: SubVisit })).rejects.toThrow(MSG);
    });
  }

  if (canReturnPromises) {
    test.each([
      RESOLVED_PROMISE,
      REJECTED_PROMISE,
      PENDING_PROMISE
    ])('returns promise as-is: %o', async (value) => {
      await doTest(value);
    });
  }

  test('throws the error which was thrown synchronously by an `_impl_visit*()` method', async () => {
    const value = 123n;
    await expect(doTest(value, { cls: SubVisit })).rejects.toThrow('Nope!');
  });

  describe('when `_impl_proxyAware() === false`', () => {
    test.each(PROXY_EXAMPLES)('returns the given value as-is: %o', async (value) => {
      await doTest(value);
    });
  });

  describe('when `_impl_proxyAware() === true`', () => {
    test.each(PROXY_EXAMPLES)('returns the value returned from `_impl_visitProxy()`: %o', async (value) => {
      await doTest(value, {
        cls: ProxyAwareVisitor,
        check: (got) => {
          expect(got).toEqual({ proxy: value });
          expect(got.proxy).toBe(value);
        }
      });
    });
  });
});

// Tests for plain `visit()` not easily covered by the common `visit*()` test
// mechanism above.
describe('visit()', () => {
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
});

describe.each`
methodName                  | canWrap  | value
${'_impl_visitArray'}       | ${true}  | ${[1, 2, 3]}
${'_impl_visitBigInt'}      | ${false} | ${99988777n}
${'_impl_visitBoolean'}     | ${false} | ${false}
${'_impl_visitClass'}       | ${true}  | ${class Florp {}}
${'_impl_visitFunction'}    | ${true}  | ${() => 'x'}
${'_impl_visitInstance'}    | ${true}  | ${new Set(['woo'])}
${'_impl_visitNull'}        | ${false} | ${null}
${'_impl_visitNumber'}      | ${false} | ${54.321}
${'_impl_visitPlainObject'} | ${true}  | ${{ x: 'bonk' }}
${'_impl_visitProxy'}       | ${true}  | ${new Proxy({}, {})}
${'_impl_visitString'}      | ${false} | ${'florp'}
${'_impl_visitSymbol'}      | ${false} | ${Symbol('woo')}
${'_impl_visitUndefined'}   | ${false} | ${undefined}
`('$methodName()', ({ methodName, canWrap, value }) => {
  test('returns the given value as-is (default implementation)', () => {
    const vv = new BaseValueVisitor(null);
    expect(vv[methodName](value)).toBe(value);
  });

  if (canWrap) {
    test('returns a wrapper given a needs-wrapping value', () => {
      const vv = new BaseValueVisitor(null);
      value.then = () => null;

      try {
        const got = vv[methodName](value);
        expect(got).toBeInstanceOf(VisitResult);
        expect(got.value).toBe(value);
      } finally {
        delete value.then;
      }
    });
  }
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

  test('asynchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new SubVisit([Symbol('zonk')]);

    expect(vv.visit()).rejects.toThrow('NO');
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

  test('asynchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new SubVisit({ blorp: Symbol('zonk') });

    expect(vv.visit()).rejects.toThrow('NO');
  });

  test('handles synchronously-visitable symbol properties', () => {
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

  test('handles asynchronously-visitable symbol properties', async () => {
    const SYM1 = Symbol.for('x');
    const SYM2 = Symbol('y');
    const orig = {
      [SYM1]: true,
      [SYM2]: false
    };

    const vv   = new SubVisit(orig);
    const got  = await vv.visit();
    expect(got).toBeObject();
    expect(got[SYM1]).toBe('true');
    expect(got[SYM2]).toBe('false');
  });
});

describe('_prot_wrapResult()', () => {
  test.each`
  value
  ${undefined}
  ${null}
  ${true}
  ${'boop'}
  ${123}
  ${978123n}
  ${{ x: 123 }}
  ${new Set(['x'])}
  ${() => 123}
  `('does not wrap non-promise-looking value $value', ({ value }) => {
    const vv = new BaseValueVisitor(null);
    expect(vv._prot_wrapResult(value)).toBe(value);
  });

  test('wraps a `Promise` per se', () => {
    const value = RESOLVED_PROMISE;
    const vv    = new BaseValueVisitor(null);
    const got   = vv._prot_wrapResult(value);

    expect(got).toBeInstanceOf(VisitResult);
    expect(got.value).toBe(value);
  });

  test('wraps a "thenable"', () => {
    const value = { then: () => true };
    const vv    = new BaseValueVisitor(null);
    const got   = vv._prot_wrapResult(value);

    expect(got).toBeInstanceOf(VisitResult);
    expect(got.value).toBe(value);
  });

  test('does not wrap an object with a non-function `then`', () => {
    const value = { then: 'bonk' };
    const vv    = new BaseValueVisitor(null);
    const got   = vv._prot_wrapResult(value);

    expect(got).toBe(value);
  });
});
