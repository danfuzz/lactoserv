// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { PromiseState, PromiseUtil } from '@this/async';
import { BaseValueVisitor, VisitDef, VisitRef, VisitResult }
  from '@this/valvis';


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
  Map
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
  _impl_shouldRef(value, isCycleHead_unused) {
    return (typeof value === 'object');
  }

  _impl_visitArray(node) {
    return this._prot_visitProperties(node);
  }

  async _impl_visitPlainObject(node) {
    await setImmediate();
    return this._prot_visitProperties(node);
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

describe('getVisitResult()', () => {
  test('throws if given a value that was not visited', () => {
    const vv = new BaseValueVisitor(123);

    vv.visitSync();
    expect(() => vv.getVisitResult('florp')).toThrow(/was not visited/);
  });

  test('throws before the visit completes, but then works afterwards', async () => {
    class TestVisitor extends BaseValueVisitor {
      async _impl_visitNumber(node) { return `${node}`; }
    }

    const value = 34.21;
    const vv    = new TestVisitor(value);

    expect(() => vv.getVisitResult('florp')).toThrow(/not yet started/);
    expect(() => vv.getVisitResult(value)).toThrow(/not yet started/);

    const got = vv.visitAsyncWrap();

    expect(() => vv.getVisitResult('florp')).toThrow(/not yet finished/);
    expect(() => vv.getVisitResult(value)).toThrow(/not yet finished/);

    await got;

    expect(() => vv.getVisitResult('florp')).toThrow(/was not visited/);
    expect(vv.getVisitResult(value)).toBe(`${value}`);
  });

  test('finds the root value', () => {
    class TestVisitor extends BaseValueVisitor {
      _impl_visitNumber(node) { return `${node}`; }
    }

    const value = 12.34;
    const vv    = new TestVisitor(value);

    vv.visitSync();
    expect(vv.getVisitResult(value)).toBe(`${value}`);
  });

  test('finds a sub-visit value', () => {
    class TestVisitor extends BaseValueVisitor {
      _impl_visitArray(node) { return this._prot_visitProperties(node); }
      _impl_visitNumber(node) { return `${node}`; }
    }

    const value = 12.34;
    const vv = new TestVisitor([value]);

    vv.visitSync();
    expect(vv.getVisitResult(value)).toBe(`${value}`);
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

  test('throws if the visit has not yet finished, then works after the visit is done', async () => {
    const value = { x: 123 };
    const vv    = new RefMakingVisitor(value);

    expect(() => vv.hasRefs()).toThrow(/not yet started/);

    const gotProm = vv.visitAsyncWrap();
    expect(PromiseState.isPending(gotProm)); // Baseline.

    expect(() => vv.hasRefs()).toThrow(/not yet finished/);

    // Make sure the call didn't mess up the post-visit behavior.
    await gotProm;
    expect(vv.hasRefs()).toBeFalse();
  });
});

describe('isFinished()', () => {
  test('returns `false` before the visit starts', () => {
    const vv = new BaseValueVisitor(null);

    expect(vv.isFinished()).toBeFalse();
  });

  test('returns `false` when the visit is in progress', async () => {
    class TestVisitor extends BaseValueVisitor {
      async _impl_visitNumber(node) { return node; }
    }

    const vv  = new TestVisitor(9000);
    const got = vv.visitAsyncWrap();

    expect(vv.isFinished()).toBeFalse();

    await got; // Clean up pending promise.
  });

  test('returns `true` when the visit is complete', () => {
    const vv = new BaseValueVisitor(null);

    vv.visitSync();
    expect(vv.isFinished()).toBeTrue();
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
    expect(gotRef.value).toBe(got);
    expect(vv.getVisitResult(value)).toBe(got);
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
    expect(gotRef.value).toBe(gotInner);
    expect(vv.getVisitResult(inner)).toBe(gotRef.value);
  });

  test('returns `null` given any argument if there were no refs created', () => {
    const vv  = new BaseValueVisitor(12377);
    const got = vv.visitSync();

    expect(got).toBe(12377); // Baseline
    expect(vv.refFromResultValue(12377)).toBeNull();
    expect(vv.refFromResultValue('boop')).toBeNull();
  });

  test('throws if the visit is still in progress, then works after the visit is done', async () => {
    const inner = { b: { c: 123 } };
    const value = { a1: inner, a2: inner };
    const vv    = new RefMakingVisitor(value);

    expect(() => vv.refFromResultValue('bonk')).toThrow(/not yet started/);

    const gotProm = vv.visitAsyncWrap();
    expect(PromiseState.isPending(gotProm)); // Baseline.

    expect(() => vv.hasRefs()).toThrow(/not yet finished/);
    expect(() => vv.refFromResultValue('bonk')).toThrow(/not yet finished/);

    // Make sure the call didn't mess up the post-visit behavior.
    const got = await gotProm;
    expect(vv.refFromResultValue(got.a1)).toBe(got.a2);
  });
});

// Tests for all three `visit*()` instance methods.
describe.each`
methodName          | isAsync  | isSync   | wraps
${'visitSync'}      | ${false} | ${true}  | ${false}
${'visitWrap'}      | ${true}  | ${true}  | ${true}
${'visitAsyncWrap'} | ${true}  | ${false} | ${true}
`('$methodName()', ({ methodName, isAsync, isSync, wraps }) => {
  const CIRCULAR_MSG = 'Visit is deadlocked due to circular reference';

  async function doTest(value, options = {}) {
    const {
      cls      = BaseValueVisitor,
      check    = (got, visitor_unused) => { expect(got).toBe(value); },
      runsSync = isSync && !isAsync
    } = options;

    if (isSync && !isAsync && !runsSync) {
      // This unit test shouldn't have been called for this method.
      throw new Error('Test should not have been run!');
    }

    const visitor = new cls(value);
    const got     = visitor[methodName]();

    const callCheck = (wrapperOrResult) => {
      if (wraps) {
        const wrapper = wrapperOrResult;
        expect(wrapper).toBeInstanceOf(VisitResult);
        check(wrapper.value, visitor);
      } else {
        const result = wrapperOrResult;
        check(result, visitor);
      }
    };

    if (runsSync && isSync) {
      callCheck(got);
    } else {
      expect(got).toBeInstanceOf(Promise);
      callCheck(await got);
    }
  }

  test.each([...EXAMPLES])('returns the given synchronously-available value as-is: %o', async (value) => {
    await doTest(value, { runsSync: true });
  });

  describe('when `_impl_proxyAware() === false`', () => {
    test.each(PROXY_EXAMPLES)('returns the given value as-is: %o', async (value) => {
      await doTest(value, { runsSync: true });
    });
  });

  describe('when `_impl_proxyAware() === true`', () => {
    test.each(PROXY_EXAMPLES)('returns the value returned from `_impl_visitProxy()`: %o', async (value) => {
      await doTest(value, {
        cls:      ProxyAwareVisitor,
        runsSync: true,
        check: (got) => {
          expect(got).toEqual({ proxy: value });
          expect(got.proxy).toBe(value);
        }
      });
    });
  });

  describe.each`
  label         | value
  ${'pending'}  | ${PENDING_PROMISE}
  ${'resolved'} | ${RESOLVED_PROMISE}
  ${'rejected'} | ${REJECTED_PROMISE}
  `('when the direct result is a $label promise', ({ value }) => {
    test('returns the promise as-is when synchronously available', async () => {
      class TestVisitor extends BaseValueVisitor {
        _impl_visitInstance(node) {
          return new VisitResult(node);
        }
      }

      await doTest(value, {
        cls:      TestVisitor,
        runsSync: true
      });
    });

    if (isAsync) {
      test('returns the promise as-is when asynchronously available', async () => {
        class TestVisitor extends BaseValueVisitor {
          async _impl_visitInstance(node) {
            await setImmediate();
            return new VisitResult(node);
          }
        }

        await doTest(value, {
          cls:      TestVisitor,
          runsSync: false
        });
      });
    }
  });

  test('throws the right error if given a value whose synchronous visit directly encountered a circular reference', async () => {
    class TestVisitor extends BaseValueVisitor {
      _impl_visitArray(node) { return this._prot_visitProperties(node); }
    }

    const circ1 = [4];
    const circ2 = [5, 6, circ1];
    const value = [1, [2, 3, circ1]];

    circ1.push(circ2);

    await expect(
      doTest(value, {
        cls:      TestVisitor,
        runsSync: true
      })
    ).rejects.toThrow(CIRCULAR_MSG);
  });

  test('handles non-circular synchronously-visited duplicate references correctly (one ref)', async () => {
    class TestVisitor extends BaseValueVisitor {
      _impl_visitArray(node) { return this._prot_visitProperties(node); }
      _impl_visitNumber(node) { return `${node}`; }
    }

    const inner = [1];
    const outer = [inner, inner];

    await doTest(outer, {
      cls:      TestVisitor,
      runsSync: true,
      check: (got) => {
        expect(got).toBeArrayOfSize(2);
        expect(got[0]).toBe(got[1]);
        const gotInner = got[0];
        expect(gotInner).toBeArrayOfSize(1);
        expect(gotInner[0]).toBe('1');
      }
    });
  });

  test('handles non-circular synchronously-visited duplicate references correctly (one ref)', async () => {
    class TestVisitor extends BaseValueVisitor {
      _impl_visitArray(node) { return this._prot_visitProperties(node); }
      _impl_visitNumber(node) { return `${node}`; }
    }

    const inner = [1];
    const outer = [inner, inner];

    await doTest(outer, {
      cls:      TestVisitor,
      runsSync: true,
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
    class TestVisitor extends BaseValueVisitor {
      _impl_visitArray(node) { return this._prot_visitProperties(node); }
      _impl_visitNumber(node) { return `${node}`; }
    }

    const inner  = [1];
    const middle = [inner, inner, inner, 2];
    const outer  = [middle, inner, middle, 3];

    await doTest(outer, {
      cls:      TestVisitor,
      runsSync: true,
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

  test('throws the error which was thrown synchronously by an `_impl_visit*()` method', async () => {
    class TestVisitor extends BaseValueVisitor {
      _impl_visitNumber(node_unused) {
        throw new Error('Nope!');
      }
    }

    await expect(
      doTest(123, {
        cls:      TestVisitor,
        runsSync: true
      })
    ).rejects.toThrow('Nope!');
  });

  // Note: This test was inspired by an observed small gap in test coverage.
  test('throws the error which was thrown synchronously during a top-level visit to a circular reference', async () => {
    const MSG = 'Not today, Satan!';

    class TestVisitor extends BaseValueVisitor {
      _impl_shouldRef(node_unused, isCycleHead_unused) {
        return true;
      }

      _impl_visitArray(node) {
        this._prot_visitProperties(node);
        throw new Error(MSG);
      }
    }

    const circle = ['circle'];
    circle.push(circle);

    await expect(doTest(circle,
      {
        cls:      TestVisitor,
        runsSync: true
      }
    )).rejects.toThrow(MSG);
  });

  if (isSync && !isAsync) {
    const MSG = 'Visit did not finish synchronously.';

    test('throws the right error if a will-be-successful visit did not finish synchronously', async () => {
      class TestVisitor extends BaseValueVisitor {
        async _impl_visitNumber(node) { return node; }
      }

      await expect(doTest(999888,
        {
          cls:      TestVisitor,
          runsSync: true
        }
      )).rejects.toThrow(MSG);
    });

    test('throws the right error if a will-fail visit did not finish synchronously', async () => {
      class TestVisitor extends BaseValueVisitor {
        async _impl_visitNumber(node_unused) { throw new Error('Bonk!'); }
      }

      await expect(doTest(65432,
        {
          cls:      TestVisitor,
          runsSync: true
        }
      )).rejects.toThrow(MSG);
    });
  }

  if (isAsync) {
    test('returns the value which was returned asynchronously by an `_impl_visit*()` method', async () => {
      class TestVisitor extends BaseValueVisitor {
        async _impl_visitBoolean(node) {
          await setImmediate();
          return `${node}`;
        }
      }

      await doTest(true, {
        cls: TestVisitor,
        check: (got) => {
          expect(got).toBe('true');
        }
      });
    });

    test('handles non-circular asynchronously-visited duplicate references correctly', async () => {
      class TestVisitor extends BaseValueVisitor {
        _impl_visitArray(node) { return this._prot_visitProperties(node); }
        async _impl_visitBoolean(node) {
          await setImmediate();
          return `${node}`;
        }
      }

      const inner  = [true];
      const middle = [inner, inner, inner, true];
      const outer  = [middle, inner, middle, false];

      await doTest(outer, {
        cls: TestVisitor,
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
      class TestVisitor extends BaseValueVisitor {
        async _impl_visitBoolean(node_unused) { throw new Error('oof!'); }
      }

      await expect(doTest(true, { cls: TestVisitor }))
        .rejects.toThrow('oof!');
    });

    test('throws the right error if given a value whose asynchronous visit would directly contain a circular reference', async () => {
      class TestVisitor extends BaseValueVisitor {
        _impl_visitArray(node) { return this._prot_visitProperties(node); }
        async _impl_visitBoolean(node) {
          await setImmediate();
          return `${node}`;
        }
      }

      const circ1 = [true, 4];
      const circ2 = [true, 5, 6, circ1];
      const value = [true, 1, [2, 3, circ1]];

      circ1.push(circ2);

      await expect(doTest(value, { cls: TestVisitor }))
        .rejects.toThrow(CIRCULAR_MSG);
    });

    test('throws the right error if given a value whose asynchronous visit would directly contain a circular reference (even more async)', async () => {
      class TestVisitor extends BaseValueVisitor {
        async _impl_visitArray(node) {
          await setImmediate();
          return this._prot_visitProperties(node);
        }

        async _impl_visitBoolean(node) {
          await setImmediate();
          return `${node}`;
        }
      }

      const circ1 = [true, 4];
      const circ2 = [true, 5, 6, circ1];
      const value = [true, 1, [2, 3, circ1]];

      circ1.push(circ2);

      await expect(doTest(value, { cls: TestVisitor }))
        .rejects.toThrow(CIRCULAR_MSG);
    });
  }

  test.each`
  value
  ${null}
  ${undefined}
  ${true}
  ${123}
  `('does not call `_impl_shouldRef()` on $value', async ({ value }) => {
    class TestVisitor extends BaseValueVisitor {
      _impl_shouldRef() { throw new Error('Oopsie'); }
      _impl_visitArray(node) { return this._prot_visitProperties(node); }
    }

    await doTest([value, value], {
      cls:      TestVisitor,
      runsSync: true,
      check:    () => null
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
    class TestVisitor extends BaseValueVisitor {
      calledOn = [];

      _impl_shouldRef(node, isCycleHead_unused) {
        this.calledOn.push(node);
        return false;
      }

      _impl_visitArray(node) {
        return this._prot_visitProperties(node);
      }
    }

    await doTest([value, value], {
      cls:      TestVisitor,
      runsSync: true,
      check: (got_unused, visitor) => {
        expect(visitor.calledOn).toStrictEqual([value]);
      }
    });
  });

  describe('when `_impl_shouldRef()` returns `false` (which is by default)', () => {
    test.each`
    label             | value                     | expected
    ${'array'}        | ${[99, 88, 123]}          | ${[99, 88, 123]}
    ${'plain object'} | ${{ zonk: 'zeep' }}       | ${{ zonk: 'zeep' }}
    ${'function'}     | ${() => 'x'}              | ${'() => \'x\''}
    ${'instance'}     | ${new Set('a', 'z', 'x')} | ${'[object Set]'}
    `('does not make a ref for a shared $label', async ({ value, expected }) => {
      class TestVisitor extends BaseValueVisitor {
        _impl_visitArray(node) { return this._prot_visitProperties(node); }
        _impl_visitPlainObject(node) { return this._prot_visitProperties(node); }
        _impl_visitInstance(node) { return node.toString(); }
        _impl_visitFunction(node) { return node.toString(); }
      }

      await doTest([value, value], {
        cls:      TestVisitor,
        runsSync: true,
        check: (got) => {
          expect(got).toBeArrayOfSize(2);
          expect(got[0]).toBe(got[1]);
          expect(got[0]).toEqual(expected);
        }
      });
    });
  });

  describe('when `_impl_shouldRef()` can return `true`', () => {
    class TestVisitor extends RefMakingVisitor {
      cycleHeads = [];
      refs       = [];

      _impl_shouldRef(node, isCycleHead) {
        if (isCycleHead) {
          this.cycleHeads.push(node);
        }

        return super._impl_shouldRef(node, isCycleHead);
      }

      _impl_newRef(ref) {
        this.refs.push({ ref, wasFinished: ref.isFinished() });
      }
    }

    test('makes a ref and calls `_impl_newRef()` when a non-circular shared reference is detected', async () => {
      const shared = [9, 99, 999];
      const value  = [1, [2, shared], shared];

      await doTest(value, {
        cls:      TestVisitor,
        runsSync: true,
        check: (got, visitor) => {
          expect(visitor.refs).toBeArrayOfSize(1);
          const { ref, wasFinished } = visitor.refs[0];
          expect(ref).toBe(got[2]);
          expect(ref.value).toBe(got[1][1]);
          expect(visitor.getVisitResult(shared)).toBe(ref.value);
          expect(wasFinished).toBeTrue();

          expect(visitor.cycleHeads).toBeArrayOfSize(0);
        }
      });
    });

    test('makes a ref and calls `_impl_newRef()` when a circular reference is detected', async () => {
      const selfRef = [9, 99];
      const value   = [1, [2, selfRef], selfRef];

      selfRef.push(selfRef);

      await doTest(value, {
        cls:      TestVisitor,
        runsSync: true,
        check: (got, visitor) => {
          expect(visitor.refs).toBeArrayOfSize(1);
          const { ref, wasFinished } = visitor.refs[0];
          expect(ref).toBe(got[2]);
          expect(ref.value).toBe(got[1][1]);
          expect(visitor.getVisitResult(selfRef)).toBe(ref.value);
          expect(ref).toBe(ref.value[2]);
          expect(wasFinished).toBeFalse();

          expect(visitor.cycleHeads).toBeArrayOfSize(1);
          expect(visitor.cycleHeads[0]).toBe(selfRef);
        }
      });
    });
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

describe('_impl_revisit()', () => {
  class RevisitCheckVisitor extends BaseValueVisitor {
    #doRefs;
    calledArgs = [];

    constructor(value, doRefs = true) {
      super(value);
      this.#doRefs = doRefs;
    }

    _impl_shouldRef(node, isCycleHead_unused) {
      return this.#doRefs && (typeof node === 'object');
    }

    _impl_visitArray(node) {
      return this._prot_visitProperties(node);
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
  label                     | value
  ${'null'}                 | ${null}
  ${'undefined'}            | ${undefined}
  ${'a boolean'}            | ${true}
  ${'a number'}             | ${12345}
  ${'a bigint'}             | ${123987n}
  ${'a string'}             | ${'stringy-string'}
  ${'an uninterned symbol'} | ${Symbol('blort')}
  ${'an interned symbol'}   | ${Symbol.for('zorch')}
  ${'an array'}             | ${[4, 5, 9]}
  ${'a plain object'}       | ${{ x: 'boop' }}
  ${'an instance'}          | ${new Set('foo', 'bar')}
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
      vv[rootImpl]    = () => vv._prot_visitProperties([value]);

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

// Extra tests beyond the baseline above.
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
      return this._prot_visitProperties(node);
    }

    _impl_visitInstance(node) {
      this.gotNodes.push(node);
      return 'yes-sir';
    }
  }

  test('gets called on an instance of `VisitRef` that was not created by the visitor-in-progress', () => {
    const ref = new VisitRef(new VisitDef(10));
    const vv  = new VisitInstanceCheckVisitor([ref]);

    expect(vv.visitSync()).toStrictEqual(['yes-sir']);
    expect(vv.gotNodes).toStrictEqual([ref]);
  });

  test('gets called on an instance of `VisitDef` that was not created by the visitor-in-progress', () => {
    const def = new VisitDef(4321);
    const vv  = new VisitInstanceCheckVisitor([def]);

    expect(vv.visitSync()).toStrictEqual(['yes-sir']);
    expect(vv.gotNodes).toStrictEqual([def]);
  });
});

// Extra tests beyond the baseline above.
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

// Extra tests beyond the baseline above.
describe('_impl_visitSymbol()', () => {
  class TestVisitor extends BaseValueVisitor {
    _impl_visitSymbol(node, isInterned) {
      return `${node.description}-${isInterned}`;
    }
  }

  test('given an uninterned symbol, gets passed `isInterned === false`', () => {
    const vv = new TestVisitor(Symbol('zonk'));
    expect(vv.visitSync()).toStrictEqual('zonk-false');
  });

  test('given an interned symbol, gets passed `isInterned === true`', () => {
    const vv = new TestVisitor(Symbol.for('bleep'));
    expect(vv.visitSync()).toStrictEqual('bleep-true');
  });
});

// Tests for the `_prot_visit*()` methods.
describe.each`
methodName           | isAsync  | wraps
${'_prot_visitSync'} | ${false} | ${false}
${'_prot_visitWrap'} | ${true}  | ${true}
`('$methodName()', ({ methodName, isAsync, wraps }) => {
  function checkResult(got, expected) {
    if (wraps) {
      expect(got).toBeInstanceOf(VisitResult);
      got = got.value;
    }

    expect(got).toBe(expected);
  }

  async function checkResultPromise(got, expected) {
    expect(got).toBeInstanceOf(Promise);
    checkResult(await got, expected);
  }

  test('works synchronously when possible', () => {
    class VisitCheckVisitor extends BaseValueVisitor {
      _impl_visitNumber(node) {
        return `${node}!`;
      }

      _impl_visitString(node_unused) {
        const got = this[methodName](9999);
        checkResult(got, '9999!');
        return 'yep';
      }
    }

    const got = new VisitCheckVisitor('boop').visitSync();
    expect(got).toBe('yep');
  });

  if (isAsync) {
    test('works asynchronously when necessary', async () => {
      class VisitCheckVisitor extends BaseValueVisitor {
        async _impl_visitNumber(node) {
          return `${node}!`;
        }

        async _impl_visitString(node_unused) {
          const got = this[methodName](98765);
          await checkResultPromise(got, '98765!');
          return 'yep';
        }
      }

      const got = await new VisitCheckVisitor('boop').visitAsyncWrap();
      expect((await got).value).toBe('yep');
    });
  } else {
    test('throws an error when not able to complete synchronously', async () => {
      class VisitCheckVisitor extends BaseValueVisitor {
        async _impl_visitNumber(node) {
          return `${node}!`;
        }

        async _impl_visitString(node_unused) {
          expect(() => this[methodName](112233)).toThrow(/Visit did not finish/);
          return 'yep';
        }
      }

      const got = await new VisitCheckVisitor('boop').visitAsyncWrap();
      expect((await got).value).toBe('yep');
    });
  }
});

describe('_prot_visitProperties()', () => {
  class VisitPropertiesCheckVisitor extends BaseValueVisitor {
    #beAsync;
    #doErrors;
    #doEntries;

    constructor(value, { async = false, errors = false, entries = false } = {}) {
      super(value);
      this.#beAsync   = async;
      this.#doErrors  = errors;
      this.#doEntries = entries;
    }

    _impl_visitNumber(node) {
      if (this.#doErrors) {
        return this.#doVisit(() => {
          throw new Error(`Ouch: ${node}`);
        });
      } else {
        return this.#doVisit(() => `${node}%`);
      }
    }

    _impl_visitArray(node) {
      return this.#doVisit(() => this._prot_visitProperties(node, this.#doEntries));
    }

    _impl_visitPlainObject(node) {
      return this.#doVisit(() => this._prot_visitProperties(node, this.#doEntries));
    }

    #doVisit(func) {
      if (this.#beAsync) {
        return (async () => {
          await setImmediate();
          return func();
        })();
      } else {
        return func();
      }
    }
  }

  const SPARSE_ARRAY_VALUE  = [77, /*empty*/, 88]; // eslint-disable-line no-sparse-arrays
  const SPARSE_ARRAY_RESULT = ['77%', /*empty*/, '88%']; // eslint-disable-line no-sparse-arrays
  describe.each`
  label                | value                             | proto              | expected
  ${'a plain object'}  | ${{ a: 12, b: 45, c: { d: 98 } }} | ${null}            | ${{ a: '12%', b: '45%', c: { d: '98%' } }}
  ${'a regular array'} | ${[11, 22, [33]]}                 | ${Array.prototype} | ${['11%', '22%', ['33%']]}
  ${'a sparse array'}  | ${SPARSE_ARRAY_VALUE}             | ${Array.prototype} | ${SPARSE_ARRAY_RESULT}
  `('given $label', ({ value, proto, expected }) => {
    function checkProps(got) {
      const expectProps = [
        ...Object.getOwnPropertyNames(expected),
        ...Object.getOwnPropertySymbols(expected)
      ];
      const gotProps = [
        ...Object.getOwnPropertyNames(got),
        ...Object.getOwnPropertySymbols(got)
      ];

      expect(gotProps).toStrictEqual(expectProps);
    }

    function checkEntries(got) {
      checkProps(Object.fromEntries(got));
    }

    test('operates synchronously when possible', () => {
      const vv   = new VisitPropertiesCheckVisitor(value);
      const got  = vv.visitSync();

      expect(Object.getPrototypeOf(got)).toBe(proto);
      expect(got).toEqual(expected);
      checkProps(got);
    });

    test('operates asynchronously when called as such but not strictly necessary', async () => {
      const vv   = new VisitPropertiesCheckVisitor(value);
      const got  = vv.visitAsyncWrap();

      expect(got).toBeInstanceOf(Promise);

      const result = (await got).value;
      expect(Object.getPrototypeOf(result)).toBe(proto);
      expect(result).toEqual(expected);
      checkProps(result);
    });

    test('operates asynchronously when necessary', async () => {
      const vv  = new VisitPropertiesCheckVisitor(value, { async: true });
      const got = vv.visitAsyncWrap();

      expect(got).toBeInstanceOf(Promise);

      const result = (await got).value;
      expect(Object.getPrototypeOf(result)).toBe(proto);
      expect(result).toEqual(expected);
      checkProps(result);
    });

    test('produces entries (when asked)', () => {
      const vv  = new VisitPropertiesCheckVisitor(value, { entries: true });
      const got = vv.visitSync();

      checkEntries(got);
    });

    test('produces entries (when asked) including extra symbol-valued properties', () => {
      const sym = Symbol('blonk');
      value = Array.isArray(value) ? [...value] : { ...value };
      value[sym] = 987;
      expected = Array.isArray(expected) ? [...expected] : { ...expected };
      expected[sym] = '987%';

      const vv  = new VisitPropertiesCheckVisitor(value, { entries: true });
      const got = vv.visitSync();

      checkEntries(got);
    });

    test('synchronously propagates an error thrown synchronously by one of the sub-calls', () => {
      const vv = new VisitPropertiesCheckVisitor(value, { errors: true });

      expect(() => vv.visitSync()).toThrow(/Ouch/);
    });

    test('asynchronously propagates an error thrown asynchronously by one of the sub-calls', async () => {
      const vv  = new VisitPropertiesCheckVisitor(value, { async: true, errors: true });
      const got = vv.visitAsyncWrap();

      expect(got).toBeInstanceOf(Promise);
      await expect(got).rejects.toThrow(/Ouch/);
    });

    test('synchronously handles extra symbol properties if possible', () => {
      const sym = Symbol('beep');
      value = Array.isArray(value) ? [...value] : { ...value };
      value[sym] = 914;
      expected = Array.isArray(expected) ? [...expected] : { ...expected };
      expected[sym] = '914%';

      const vv  = new VisitPropertiesCheckVisitor(value);
      const got = vv.visitSync();

      expect(got).toEqual(expected);
      checkProps(got);
    });

    test('asynchronously handles extra symbol properties when necessary', async () => {
      const sym = Symbol('beep');
      value = Array.isArray(value) ? [...value] : { ...value };
      value[sym] = 914;
      expected = Array.isArray(expected) ? [...expected] : { ...expected };
      expected[sym] = '914%';

      const vv  = new VisitPropertiesCheckVisitor(value, { async: true });
      const got = vv.visitAsyncWrap();

      expect(got).toBeInstanceOf(Promise);

      const result = (await got).value;
      expect(result).toEqual(expected);
      checkProps(result);
    });

    if (Array.isArray(value)) {
      test('synchronously handles extra string properties if possible', () => {
        value = [...value];
        value.bloop = 321;
        expected = [...expected];
        expected.bloop = '321%';

        const vv  = new VisitPropertiesCheckVisitor(value);
        const got = vv.visitSync();

        expect(got).toEqual(expected);
        checkProps(got);
      });

      test('asynchronously handles extra string properties when necessary', async () => {
        value = [...value];
        value.bloop = 321;
        expected = [...expected];
        expected.bloop = '321%';

        const vv   = new VisitPropertiesCheckVisitor(value, { async: true });
        const got  = vv.visitAsyncWrap();

        const result = (await got).value;
        expect(result).toEqual(expected);
        checkProps(result);
      });
    }
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


//
// Static members
//

// Tests for all three `visit*()` static methods.
describe.each`
methodName          | isAsync  | isSync   | wraps
${'visitSync'}      | ${false} | ${true}  | ${false}
${'visitWrap'}      | ${true}  | ${true}  | ${true}
${'visitAsyncWrap'} | ${true}  | ${false} | ${true}
`('$methodName()', ({ methodName, isAsync, isSync, wraps }) => {
  if (isSync) {
    test('works on a smoke-test-ish sync example', () => {
      class TestVisitor extends BaseValueVisitor {
        _impl_visitArray(node) { return this._prot_visitProperties(node); }
        _impl_visitNumber(node) { return `${node}`; }
        _impl_visitPlainObject(node) { return this._prot_visitProperties(node); }
      }

      const value    = [1, 2, { a: 123 }, true];
      const expected = ['1', '2', { a: '123' }, true];
      const got      = TestVisitor[methodName](value);

      if (wraps) {
        const wrapper = got;
        expect(wrapper).toBeInstanceOf(VisitResult);
        expect(wrapper.value).toEqual(expected);
      } else {
        expect(got).toEqual(expected);
      }
    });
  }

  if (isAsync) {
    test('works on a smoke-test-ish async example', async () => {
      class TestVisitor extends BaseValueVisitor {
        _impl_visitArray(node) { return this._prot_visitProperties(node); }
        _impl_visitPlainObject(node) { return this._prot_visitProperties(node); }

        async _impl_visitNumber(node) {
          await null;
          return `${node}`;
        }
      }

      const value      = [7, 8, { a: 987 }, false];
      const expected   = ['7', '8', { a: '987' }, false];
      const gotPromise = TestVisitor[methodName](value);

      expect(gotPromise).toBeInstanceOf(Promise);
      await expect(gotPromise).toResolve();
      const got = await gotPromise;

      if (wraps) {
        const wrapper = got;
        expect(wrapper).toBeInstanceOf(VisitResult);
        expect(wrapper.value).toEqual(expected);
      } else {
        expect(got).toEqual(expected);
      }
    });
  }
});
