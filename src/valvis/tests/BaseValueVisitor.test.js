// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { ManualPromise, PromiseState, PromiseUtil } from '@this/async';
import { BaseValueVisitor, VisitDef, VisitRef, VisitResult } from '@this/valvis';


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
 * Visitor subclass, with some synchronous and some asynchronous behavior, which
 * recursively visits plain objects and arrays.
 */
class RecursiveVisitor extends BaseValueVisitor {
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

/**
 * Visitor subclass, which is set up to use refs for duplicate objects.
 */
class RefMakingVisitor extends BaseValueVisitor {
  refs = [];

  _impl_newRef(ref) {
    this.refs.push({ ref, wasFinished: ref.isFinished() });
  }

  _impl_shouldRef(value) {
    return (typeof value === 'object');
  }

  _impl_visitArray(node) {
    return this._prot_visitArrayProperties(node);
  }

  async _impl_visitPlainObject(node) {
    await setImmediate();
    return this._prot_visitObjectProperties(node);
  }
}

describe('constructor()', () => {
  const CASES = [...EXAMPLES, ...PROXY_EXAMPLES, ...PROMISE_EXAMPLES];
  test.each(CASES)('does not throw given value: %o', (value) => {
    expect(() => new BaseValueVisitor(value)).not.toThrow();
  });
});

describe('.rootValue', () => {
  test('is the value passed into the constructor', () => {
    const value = ['yes', 'this', 'is', 'it'];
    const vv    = new BaseValueVisitor(value);
    expect(vv.rootValue).toBe(value);
  });
});

describe('hasRefs()', () => {
  test('returns `false` after a visit where no refs were created', () => {
    const vv  = new BaseValueVisitor(123);
    const got = vv.visitSync();

    expect(got).toBe(123); // Baseline

    // The actual test.
    expect(vv.hasRefs()).toBeFalse();

    // Also check that a second call returns the same value (which was a
    // different code path at least at some point).
    expect(vv.hasRefs()).toBeFalse();
  });

  test('returns `true` after a visit ends where refs are created', () => {
    const shared = [123];
    const value = [shared, shared];

    const vv  = new RefMakingVisitor(value);
    const got = vv.visitSync();

    // Baseline.
    expect(got).toBeArrayOfSize(2);
    const gotRef = got[1];
    expect(gotRef).toBeInstanceOf(VisitRef);

    // The actual test.
    expect(vv.hasRefs()).toBeTrue();

    // Also check that a second call returns the same value (which was a
    // different code path at least at some point).
    expect(vv.hasRefs()).toBeTrue();
  });

  test('returns `null` if the visit is still in progress, then works after the visit is done', async () => {
    const value   = { x: 123 };
    const vv      = new RefMakingVisitor(value);
    const gotProm = vv.visit();

    expect(PromiseState.isPending(gotProm)); // Baseline.
    expect(vv.hasRefs()).toBeNull();

    // Make sure the call didn't mess up the post-visit behavior.
    await gotProm;
    expect(vv.hasRefs()).toBeFalse();
  });
});

describe('refFromResultValue()', () => {
  test('finds a root result reference', () => {
    // Note: This test can only possibly work if the root value itself
    // participates in a reference cycle.
    const value = [12399];
    value.push(value);

    const vv  = new RefMakingVisitor(value);
    const got = vv.visitSync();

    // Baseline.
    expect(got).toBeArrayOfSize(2);
    expect(got[0]).toBe(12399);
    const gotRef = got[1];
    expect(gotRef).toBeInstanceOf(VisitRef);

    // The actual test.
    expect(vv.refFromResultValue(got)).toBe(gotRef);
    expect(gotRef.originalValue).toBe(value);
    expect(gotRef.value).toBe(got);
  });

  test('finds a sub-visit result reference', () => {
    const inner = [12388];
    const value = [inner, inner];

    const vv  = new RefMakingVisitor(value);
    const got = vv.visitSync();

    // Baseline.
    expect(got).toBeArrayOfSize(2);
    const gotInner = got[0];
    const gotRef = got[1];
    expect(gotInner).toEqual(inner);
    expect(gotInner).not.toBe(inner);
    expect(gotRef).toBeInstanceOf(VisitRef);

    // The actual test.
    expect(vv.refFromResultValue(gotInner)).toBe(gotRef);
    expect(gotRef.originalValue).toBe(inner);
    expect(gotRef.value).toBe(gotInner);
  });

  test('returns `null` given any argument if there were no refs created', () => {
    const vv  = new BaseValueVisitor(12377);
    const got = vv.visitSync();

    expect(got).toBe(12377); // Baseline
    expect(vv.refFromResultValue(12377)).toBeNull();
    expect(vv.refFromResultValue('boop')).toBeNull();
  });

  test('returns `null` given any argument if the visit is still in progress, then works after the visit is done', async () => {
    const inner   = { b: { c: 123 } };
    const value   = { a1: inner, a2: inner };
    const vv      = new RefMakingVisitor(value);
    const gotProm = vv.visit();

    expect(PromiseState.isPending(gotProm)); // Baseline.
    expect(vv.refFromResultValue('bonk')).toBeNull();

    // Make sure the call didn't mess up the post-visit behavior.
    const got = await gotProm;
    expect(vv.refFromResultValue(got.a1)).toBe(got.a2);
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
      cls   = BaseValueVisitor,
      check = (got, visitor_unused) => { expect(got).toBe(value); }
    } = options;

    const visitor = new cls(value);

    if (isAsync) {
      const got = visitor[methodName]();
      expect(got).toBeInstanceOf(Promise);
      if (wraps) {
        const wrapper = await got;
        expect(wrapper).toBeInstanceOf(VisitResult);
        check(wrapper.value, visitor);
      } else {
        check(await got, visitor);
      }
    } else {
      check(visitor[methodName](), visitor);
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

    await expect(doTest(value, { cls: RecursiveVisitor })).rejects.toThrow(CIRCULAR_MSG);
  });

  test('handles non-circular synchronously-visited duplicate references correctly (one ref)', async () => {
    const inner = [1];
    const outer = [inner, inner];

    await doTest(outer, {
      cls: RecursiveVisitor,
      check: (got) => {
        expect(got).toBeArrayOfSize(2);
        expect(got[0]).toBe(got[1]);
        const gotInner = got[0];
        expect(gotInner).toBeArrayOfSize(1);
        expect(gotInner[0]).toBe('1');
      }
    });
  });

  test('handles non-circular synchronously-visited duplicate references correctly (two refs)', async () => {
    const inner  = [1];
    const middle = [inner, inner, inner, 2];
    const outer  = [middle, inner, middle, 3];

    await doTest(outer, {
      cls: RecursiveVisitor,
      check: (got) => {
        expect(got).toBeArrayOfSize(4);
        expect(got[0]).toBe(got[2]);
        expect(got[3]).toBe('3');
        const gotMiddle = got[0];
        const gotInner  = got[1];
        expect(gotMiddle[0]).toBe(gotInner);
        expect(gotMiddle[1]).toBe(gotInner);
        expect(gotMiddle[2]).toBe(gotInner);
        expect(gotMiddle[3]).toEqual('2');
        expect(gotInner).toEqual(['1']);
      }
    });
  });

  if (isAsync) {
    test('returns the value which was returned asynchronously by an `_impl_visit*()` method', async () => {
      const value = true;
      await doTest(value, {
        cls: RecursiveVisitor,
        check: (got) => {
          expect(got).toBe('true');
        }
      });
    });

    test('handles non-circular asynchronously-visited duplicate references correctly', async () => {
      const inner  = [true];
      const middle = [inner, inner, inner, true];
      const outer  = [middle, inner, middle, false];

      await doTest(outer, {
        cls: RecursiveVisitor,
        check: (got) => {
          expect(got).toBeArrayOfSize(4);
          expect(got[0]).toBe(got[2]);
          expect(got[3]).toBe('false');
          const gotMiddle = got[0];
          const gotInner  = got[1];
          expect(gotMiddle[0]).toBe(gotInner);
          expect(gotMiddle[1]).toBe(gotInner);
          expect(gotMiddle[2]).toBe(gotInner);
          expect(gotMiddle[3]).toEqual('true');
          expect(gotInner).toEqual(['true']);
        }
      });
    });

    test('throws the error which was thrown asynchronously by an `_impl_visit*()` method', async () => {
      const value = Symbol('eep');
      await expect(doTest(value, { cls: RecursiveVisitor })).rejects.toThrow('NO');
    });

    test('throws the right error if given a value whose asynchronous visit would directly contain a circular reference', async () => {
      const circ1 = [true, 4];
      const circ2 = [true, 5, 6, circ1];
      const value = [true, 1, [2, 3, circ1]];

      circ1.push(circ2);

      await expect(doTest(value, { cls: RecursiveVisitor })).rejects.toThrow(CIRCULAR_MSG);
    });

    test('throws the right error if given a value whose asynchronous visit would directly contain a circular reference (even more async)', async () => {
      class ExtraAsyncVisitor extends RecursiveVisitor {
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
      await expect(doTest(value, { cls: RecursiveVisitor })).rejects.toThrow(MSG);
    });

    test('throws the right error if a will-fail visit did not finish synchronously', async () => {
      const value = Symbol('eeeeek');
      await expect(doTest(value, { cls: RecursiveVisitor })).rejects.toThrow(MSG);
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
    await expect(doTest(value, { cls: RecursiveVisitor })).rejects.toThrow('Nope!');
  });

  test('calls `_impl_newRef()` when a non-circular reference is detected', async () => {
    const shared = [9, 99, 999];
    const value  = [1, [2, shared], shared];

    await doTest(value, {
      cls: RefMakingVisitor,
      check: (got, visitor) => {
        expect(visitor.refs).toBeArrayOfSize(1);
        const { ref, wasFinished } = visitor.refs[0];
        expect(ref).toBe(got[2]);
        expect(ref.originalValue).toBe(shared);
        expect(ref.value).toBe(got[1][1]);
        expect(wasFinished).toBeTrue();
      }
    });
  });

  test('calls `_impl_newRef()` when a circular reference is detected', async () => {
    const selfRef = [9, 99];
    const value   = [1, [2, selfRef], selfRef];

    selfRef.push(selfRef);

    await doTest(value, {
      cls: RefMakingVisitor,
      check: (got, visitor) => {
        expect(visitor.refs).toBeArrayOfSize(1);
        const { ref, wasFinished } = visitor.refs[0];
        expect(ref).toBe(got[2]);
        expect(ref.originalValue).toBe(selfRef);
        expect(ref.value).toBe(got[1][1]);
        expect(ref).toBe(ref.value[2]);
        expect(wasFinished).toBeFalse();
      }
    });
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

  test.each`
  value
  ${null}
  ${undefined}
  ${true}
  ${123}
  `('does not call `_impl_shouldRef()` on $value', async ({ value }) => {
    class ShouldRefThrowsVisitor extends BaseValueVisitor {
      _impl_shouldRef() {
        throw new Error('Oopsie');
      }

      _impl_visitArray(node) {
        return this._prot_visitArrayProperties(node);
      }
    }

    await doTest([value, value], {
      cls: ShouldRefThrowsVisitor,
      check: () => null
    });
  });

  test.each`
  label                     | value
  ${'a string'}             | ${'xyz'}
  ${'an uninterned symbol'} | ${Symbol('blort')}
  ${'an interned symbol'}   | ${Symbol.for('blork')}
  ${'a bigint'}             | ${123456789n}
  ${'a plain object'}       | ${{ x: 123 }}
  ${'an array'}             | ${[1, 2, 3]}
  ${'an instance'}          | ${new Map()}
  ${'a function'}           | ${() => null}
  `('calls `_impl_shouldRef()` on $label', async ({ value }) => {
    class ShouldRefCheckVisitor extends BaseValueVisitor {
      calledOn = [];

      _impl_shouldRef(node) {
        this.calledOn.push(node);
        return false;
      }

      _impl_visitArray(node) {
        return this._prot_visitArrayProperties(node);
      }
    }

    await doTest([value, value], {
      cls: ShouldRefCheckVisitor,
      check: (got_unused, visitor) => {
        expect(visitor.calledOn).toStrictEqual([value]);
      }
    });
  });

  describe('when `_impl_shouldRef()` can return `true`', () => {
    test('makes a ref for a non-circular duplicate value', async () => {
      const inner = ['bonk'];
      const outer = [inner, [inner], inner];

      await doTest(outer, {
        cls: RefMakingVisitor,
        check: (got) => {
          expect(got).toBeArrayOfSize(3);

          const gotInner  = got[0];
          const gotMiddle = got[1];

          expect(gotInner).toEqual(['bonk']);
          expect(gotMiddle).toBeArrayOfSize(1);

          const gotRef = gotMiddle[0];

          expect(gotRef).toBeInstanceOf(VisitRef);
          expect(got[2]).toBeInstanceOf(VisitRef);
          expect(gotRef).toBe(got[2]);
          expect(gotRef.originalValue).toBe(inner);
          expect(gotRef.value).toBe(gotInner);
        }
      });
    });

    test('makes a ref for a circularly-referenced value', async () => {
      const inner = ['bonk'];
      const outer = [inner, inner];

      inner.push(inner);

      await doTest(outer, {
        cls: RefMakingVisitor,
        check: (got) => {
          expect(got).toBeArrayOfSize(2);
          const gotInner = got[0];
          const gotRef   = got[1];

          expect(gotRef).toBeInstanceOf(VisitRef);
          expect(gotInner).toBeArrayOfSize(2);
          expect(gotInner[0]).toEqual('bonk');
          expect(gotInner[1]).toBeInstanceOf(VisitRef);
          expect(gotInner[1]).toBe(gotRef);
          expect(gotRef.originalValue).toBe(inner);
          expect(gotRef.value).toBe(gotInner);
        }
      });
    });

    test('makes refs with the expected `index`es', async () => {
      const shared0 = ['bonk'];
      const shared1 = ['boop'];
      const outer   = [shared0, shared1, shared0, shared1];

      await doTest(outer, {
        cls: RefMakingVisitor,
        check: (got) => {
          expect(got).toBeArrayOfSize(4);
          expect(got[2]).toBeInstanceOf(VisitRef);
          expect(got[3]).toBeInstanceOf(VisitRef);
          expect(got[2].index).toBe(0);
          expect(got[3].index).toBe(1);
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

describe('_impl_newRef()', () => {
  test('succeeds trivially (base no-op implementation)', () => {
    const vv = new BaseValueVisitor(null);
    expect(vv._impl_newRef(null)).toBeUndefined();
  });
});

describe('_impl_shouldRef()', () => {
  test('returns `false` (base implementation)', () => {
    const vv = new BaseValueVisitor(null);
    expect(vv._impl_shouldRef([])).toBeFalse();
  });
});

// Common tests for type-specific visitors.
describe.each`
methodName                  | canWrap  | testVisit | value
${'_impl_visitArray'}       | ${true}  | ${true}   | ${[1, 2, 3]}
${'_impl_visitBigInt'}      | ${false} | ${true}   | ${99988777n}
${'_impl_visitBoolean'}     | ${false} | ${true}   | ${false}
${'_impl_visitClass'}       | ${true}  | ${true}   | ${class Florp {}}
${'_impl_visitError'}       | ${true}  | ${true}   | ${new Error('bonk')}
${'_impl_visitFunction'}    | ${true}  | ${true}   | ${() => 'x'}
${'_impl_visitInstance'}    | ${true}  | ${true}   | ${new Set(['woo'])}
${'_impl_visitNull'}        | ${false} | ${true}   | ${null}
${'_impl_visitNumber'}      | ${false} | ${true}   | ${54.321}
${'_impl_visitPlainObject'} | ${true}  | ${true}   | ${{ x: 'bonk' }}
${'_impl_visitProxy'}       | ${true}  | ${false}  | ${new Proxy({}, {})}
${'_impl_visitString'}      | ${false} | ${true}   | ${'florp'}
${'_impl_visitSymbol'}      | ${false} | ${true}   | ${Symbol('woo')}
${'_impl_visitUndefined'}   | ${false} | ${true}   | ${undefined}
`('$methodName()', ({ methodName, canWrap, testVisit, value }) => {
  test('returns the given value as-is (default implementation)', () => {
    const vv = new BaseValueVisitor(null);
    expect(vv[methodName](value)).toBe(value);
  });

  if (testVisit) {
    test('gets called during a visit to a root value of the appropriate type', () => {
      const expected = ['yep', 'it', 'was', 'called'];
      const vv       = new BaseValueVisitor(value);
      vv[methodName] = () => expected;
      expect(vv.visitSync()).toBe(expected);
    });

    test('gets called during a visit to a non-root value of the appropriate type', () => {
      // What's going on: We use `null` as the root value as a hook to make a
      // sub-visit on the appropriate-typed value. _Except_, if the value is
      // `null`, then we use a string instead.
      const rootValue = (value === null) ? 'bonk' : null;
      const rootImpl  = (rootValue === null) ? '_impl_visitNull' : '_impl_visitString';
      const expected  = ['this', 'is', 'it'];
      const vv        = new BaseValueVisitor(rootValue);
      vv[methodName]  = () => expected;
      vv[rootImpl]    = () => vv._prot_visitArrayProperties([value]);

      const got = vv.visitSync();
      expect(got).toBeInstanceOf(Array);
      expect(got).toBeArrayOfSize(1);
      expect(got[0]).toBe(expected);
    });
  }

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

describe('_impl_visitError()', () => {
  test('calls through to `_impl_visitInstance()` (when not overridden)', () => {
    const vv = new BaseValueVisitor(new Error('woo'));
    vv._impl_visitInstance = () => 'yep';

    expect(vv.visitSync()).toBe('yep');
  });

  test('gets called on a direct instance of `Error`', () => {
    const vv = new BaseValueVisitor(new Error('woo'));
    vv._impl_visitError = (e) => `yes: ${e.message}`;

    expect(vv.visitSync()).toBe('yes: woo');
  });

  test('gets called on an instance of an subclass of `Error`', () => {
    const vv = new BaseValueVisitor(new TypeError('eep'));
    vv._impl_visitError = (e) => `yes: ${e.message}`;

    expect(vv.visitSync()).toBe('yes: eep');
  });
});

// Extra tests beyond the baseline above.
describe('_impl_visitInstance()', () => {
  class VisitInstanceCheckVisitor extends BaseValueVisitor {
    gotNodes = [];

    _impl_visitArray(node) {
      return this._prot_visitArrayProperties(node);
    }

    _impl_visitInstance(node) {
      this.gotNodes.push(node);
      return 'yes-sir';
    }
  }

  test('gets called on an instance of `VisitRef` that was not created by the visitor-in-progress', () => {
    const ref = new VisitRef(null, 10);
    const vv  = new VisitInstanceCheckVisitor([ref]);

    expect(vv.visitSync()).toStrictEqual(['yes-sir']);
    expect(vv.gotNodes).toStrictEqual([ref]);
  });

  test('gets called on an instance of `VisitDef` that was not created by the visitor-in-progress', () => {
    const def = new VisitDef(null, 4321);
    const vv  = new VisitInstanceCheckVisitor([def]);

    expect(vv.visitSync()).toStrictEqual(['yes-sir']);
    expect(vv.gotNodes).toStrictEqual([def]);
  });
});

describe('_impl_revisit()', () => {
  class RevisitCheckVisitor extends BaseValueVisitor {
    #doRefs;
    calledArgs = [];

    constructor(value, doRefs = true) {
      super(value);
      this.#doRefs = doRefs;
    }

    _impl_shouldRef(node) {
      return this.#doRefs && (typeof node === 'object');
    }

    _impl_visitArray(node) {
      return this._prot_visitArrayProperties(node);
    }

    _impl_revisit(node, result, isCycleHead, ref) {
      this.calledArgs.push({ node, result, isCycleHead, ref });
    }
  }

  test('just returns `undefined` (default implementation)', () => {
    const vv = new BaseValueVisitor(null);
    expect(vv._impl_revisit('florp', 'florp', false, null)).toBeUndefined();
  });

  test('is called once on a non-circular ref that was created during the visit, when the original `value` has two references to the shared value', () => {
    const shared = ['shared'];
    const vv     = new RevisitCheckVisitor([shared, shared]);

    expect(vv.visitSync()).toBeArrayOfSize(2);
    expect(vv.calledArgs).toBeArrayOfSize(1);

    expect(vv.calledArgs[0].node).toBe(shared);
    expect(vv.calledArgs[0].result).toStrictEqual(shared);
    expect(vv.calledArgs[0].isCycleHead).toBeFalse();
    expect(vv.calledArgs[0].ref).toBeInstanceOf(VisitRef);
  });

  test('is called twice on a non-circular ref that was created during the visit, when the original `value` has three references to the shared value', () => {
    const shared = ['shared'];
    const vv     = new RevisitCheckVisitor([shared, shared, shared]);

    expect(vv.visitSync()).toBeArrayOfSize(3);
    expect(vv.calledArgs).toBeArrayOfSize(2);

    expect(vv.calledArgs[0].node).toBe(shared);
    expect(vv.calledArgs[0].result).toStrictEqual(shared);
    expect(vv.calledArgs[0].isCycleHead).toBeFalse();
    expect(vv.calledArgs[0].ref).toBeInstanceOf(VisitRef);
    expect(vv.calledArgs[1]).toStrictEqual(vv.calledArgs[0]);
  });

  test('is called once on a circular ref that was created during the visit, when the original `value` has one circular reference to the value', () => {
    const circular = ['circle'];
    circular.push(circular);

    const vv  = new RevisitCheckVisitor([circular]);
    const got = vv.visitSync();

    expect(vv.calledArgs).toBeArrayOfSize(1);

    expect(vv.calledArgs[0].node).toBe(circular);
    expect(vv.calledArgs[0].result).toBeNull();
    expect(vv.calledArgs[0].isCycleHead).toBeTrue();
    expect(vv.calledArgs[0].ref).toBeInstanceOf(VisitRef);

    expect(got).toBeArrayOfSize(1);
    expect(got[0]).toStrictEqual(['circle', vv.calledArgs[0].ref]);
  });

  test.each`
  label               | value
  ${'null'}           | ${null}
  ${'undefined'}      | ${undefined}
  ${'a boolean'}      | ${true}
  ${'a number'}       | ${12345}
  ${'a bigint'}       | ${123987n}
  ${'a string'}       | ${'stringy-string'}
  ${'a symbol'}       | ${Symbol('blort')}
  ${'an array'}       | ${[4, 5, 9]}
  ${'a plain object'} | ${{ x: 'boop' }}
  ${'an instance'}    | ${new Set('foo', 'bar')}
  `('can get called for $label', ({ value }) => {
    const vv  = new RevisitCheckVisitor([value, value], false);
    const got = vv.visitSync();

    expect(got).toBeArrayOfSize(2);
    expect(got[0]).toBe(got[1]);

    expect(vv.calledArgs).toBeArrayOfSize(1);
    expect(vv.calledArgs[0].node).toBe(value);
    expect(vv.calledArgs[0].result).toEqual(value);
    expect(vv.calledArgs[0].result).toBe(got[0]);
    expect(vv.calledArgs[0].isCycleHead).toBeFalse();
    expect(vv.calledArgs[0].ref).toBeNull();
  });
});

describe.each`
methodName                | expectVar
${'_prot_labelFromValue'} | ${'expectedLabel'}
${'_prot_nameFromValue'}  | ${'expectedName'}
`('$methodName()', ({ methodName, expectVar }) => {
  // These are expected to return their stringified versions.
  test.each`
  value
  ${null}
  ${undefined}
  ${true}
  ${123}
  ${567n}
  ${'zonk'}
  `('stringifies $value', ({ value }) => {
    const vv  = new BaseValueVisitor(null);
    const got = vv[methodName](value);
    expect(got).toBe(`${value}`);
  });

  // Special cases that don't work with proxies.
  test.each`
  label                     | value                 | expectedName     | expectedLabel
  ${'the empty string'}     | ${''}                 | ${'<anonymous>'} | ${'<anonymous>'}
  ${'an interned symbol'}   | ${Symbol.for('boop')} | ${'boop'}        | ${'symbol {boop}'}
  ${'an uninterned symbol'} | ${Symbol('bloop')}    | ${'bloop'}       | ${'symbol {bloop}'}
  ${'an anonymous class'}   | ${class {}}           | ${'<anonymous>'} | ${'class <anonymous>'}
  ${'a named class'}        | ${class Florp {}}     | ${'Florp'}       | ${'class Florp'}
  `('returns the expected form for $label', ({ value, ...expected }) => {
    const vv  = new BaseValueVisitor(null);
    const got = vv[methodName](value);
    expect(got).toBe(expected[expectVar]);
  });

  /**
   * A class which has a `.name` property.
   */
  class AvecName {
    get name() {
      return 'a-name';
    }
  }

  // An instance with a `.constructor` that isn't actually a function.
  const nonFuncConstructor = new Map();
  nonFuncConstructor.constructor = 'florp';

  // The rest.
  describe.each`
  label            | doProxy
  ${'a proxy'}     | ${true}
  ${'a non-proxy'} | ${false}
  `('$label', ({ doProxy }) => {
    test.each`
    label                                           | value                           | expectedName     | expectedLabel
    ${'an anonymous plain object'}                  | ${{ a: 123 }}                   | ${'<anonymous>'} | ${'object {...}'}
    ${'a named plain object'}                       | ${{ name: 'flomp' }}            | ${'flomp'}       | ${'flomp {...}'}
    ${'an instance of anonymous class'}             | ${new (class {})()}             | ${'<anonymous>'} | ${'<anonymous> {...}'}
    ${'an instance of named class'}                 | ${new (class Boop {})()}        | ${'<anonymous>'} | ${'Boop {...}'}
    ${'an instance with a `.name`'}                 | ${new AvecName()}               | ${'a-name'}      | ${'AvecName a-name {...}'}
    ${'an instance with a non-func `.constructor`'} | ${nonFuncConstructor}           | ${'<anonymous>'} | ${'<anonymous> {...}'}
    ${'an anonymous function'}                      | ${() => 123}                    | ${'<anonymous>'} | ${'<anonymous>()'}
    ${'a named function'}                           | ${function bip() { return 1; }} | ${'bip'}         | ${'bip()'}
    `('derives the expected name from $label', ({ value, ...expected }) => {
      const vv = new BaseValueVisitor(null);

      if (doProxy && (expectVar === 'expectedLabel')) {
        value    = new Proxy(value, {});
        expected = `Proxy {${expected[expectVar]}}`;
      } else {
        expected = expected[expectVar];
      }

      const got = vv[methodName](value);
      expect(got).toBe(expected);
    });
  });
});

describe('_impl_visitProxy()', () => {
  describe.each`
  type          | value
  ${'object'}   | ${new Proxy({}, {})}
  ${'function'} | ${new Proxy(() => null, {})}
  `('for a proxy of type `$type`', ({ value }) => {
    test('does not get called during a visit when `_impl_proxyAware()` returns `false`', () => {
      const vv = new BaseValueVisitor(value);
      vv._impl_visitProxy = () => 'wrong-value';

      expect(vv.visitSync()).toBe(value);
    });

    test('gets called during a visit when `_impl_proxyAware()` returns `true`', () => {
      const expected = 'right-value';
      const vv       = new ProxyAwareVisitor(value);
      vv._impl_visitProxy = () => expected;

      expect(vv.visitSync()).toBe(expected);
    });
  });
});

describe('_prot_visitArrayProperties()', () => {
  test('operates synchronously when possible', () => {
    const orig = [1, 2];
    const vv   = new RecursiveVisitor(orig);
    const got  = vv.visitSync();

    expect(got).toEqual(['1', '2']);
  });

  test('operates synchronously when possible, and recursively', () => {
    const orig = [1, 2, [3, 4], 5];
    const vv   = new RecursiveVisitor(orig);
    const got  = vv.visitSync();

    expect(got).toEqual(['1', '2', ['3', '4'], '5']);
  });

  test('operates asynchronously', async () => {
    const orig = [false, true];
    const vv   = new RecursiveVisitor(orig);
    const got  = await vv.visit();

    expect(got).toEqual(['false', 'true']);
  });

  test('operates asynchronously and recursively', async () => {
    const orig = [false, 1, [true, 2], false];
    const vv   = new RecursiveVisitor(orig);
    const got  = await vv.visit();

    expect(got).toEqual(['false', '1', ['true', '2'], 'false']);
  });

  test('synchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new RecursiveVisitor([456n]);

    expect(() => vv.visitSync()).toThrow('Nope!');
  });

  test('asynchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new RecursiveVisitor([Symbol('zonk')]);

    expect(vv.visit()).rejects.toThrow('NO');
  });

  test('preserves sparseness', () => {
    const UND  = undefined;
    const orig = Array(7);

    orig[2] = 'x';
    orig[4] = 'y';
    orig[5] = 5;

    const vv   = new RecursiveVisitor(orig);
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

    const vv   = new RecursiveVisitor(orig);
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

    const vv   = new RecursiveVisitor(orig);
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

    const vv   = new RecursiveVisitor(orig);
    const got  = await vv.visit();
    expect(got).toBeArrayOfSize(1);
    expect(got[0]).toBe('123');
    expect(got[SYM1]).toBe('true');
    expect(got[SYM2]).toBe('false');
  });
});

describe('_prot_visitObjectProperties()', () => {
  test('produces a `null`-prototype result', () => {
    const orig = { x: 'foomp' };
    const vv   = new RecursiveVisitor(orig);
    const got  = vv.visitSync();

    expect(got).toEqual(orig);
    expect(Object.getPrototypeOf(got)).toBeNull();
  });

  test('operates synchronously when possible', () => {
    const orig = { a: 10, b: 20 };
    const vv   = new RecursiveVisitor(orig);
    const got  = vv.visitSync();

    expect(got).toEqual({ a: '10', b: '20' });
  });

  test('operates synchronously when possible, and recursively', () => {
    const orig = { a: 1, b: 2, c: { d: 3, e: 4 }, f: 5 };
    const vv   = new RecursiveVisitor(orig);
    const got  = vv.visitSync();

    expect(got).toEqual({ a: '1', b: '2',  c: { d: '3', e: '4' }, f: '5' });
  });

  test('operates asynchronously', async () => {
    const orig = { x: false, y: true };
    const vv   = new RecursiveVisitor(orig);
    const got  = await vv.visit();

    expect(got).toEqual({ x: 'false', y: 'true' });
  });

  test('operates asynchronously and recursively', async () => {
    const orig = { x: false, y: 1, z: { a: true, b: 2 } };
    const vv   = new RecursiveVisitor(orig);
    const got  = await vv.visit();

    expect(got).toEqual({ x: 'false', y: '1', z: { a: 'true', b: '2' } });
  });

  test('synchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new RecursiveVisitor({ blorp: 456n });

    expect(() => vv.visitSync()).toThrow('Nope!');
  });

  test('asynchronously propagates an error thrown by one of the sub-calls', () => {
    const vv = new RecursiveVisitor({ blorp: Symbol('zonk') });

    expect(vv.visit()).rejects.toThrow('NO');
  });

  test('handles synchronously-visitable symbol properties', () => {
    const SYM1 = Symbol.for('x');
    const SYM2 = Symbol('y');
    const orig = {
      [SYM1]: 234,
      [SYM2]: 321
    };

    const vv   = new RecursiveVisitor(orig);
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

    const vv   = new RecursiveVisitor(orig);
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