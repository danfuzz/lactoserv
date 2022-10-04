// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { PromiseState, PromiseUtil, Threadoid } from '@this/async';


describe('constructor(function)', () => {
  test('trivially succeeds', () => {
    expect(() => new Threadoid(() => null)).not.toThrow();
  });

  test('produces an instance for which `isRunning() === false`', () => {
    const thread = new Threadoid(() => null);

    expect(thread.isRunning()).toBeFalse();
  });

  test('produces an instance for which `shouldStop() === true`', () => {
    const thread = new Threadoid(() => null);

    expect(thread.shouldStop()).toBeTrue();
  });

  test('produces an instance for which `whenStarted()` is synchronously fulfilled', async () => {
    const thread = new Threadoid(() => null);
    const result = thread.whenStarted();

    expect(PromiseState.isFulfilled(result)).toBeTrue();
  });

  test('produces an instance for which `whenStopRequested()` is pre-fulfilled', async () => {
    const thread = new Threadoid(() => null);

    const result = thread.whenStopRequested();
    expect(PromiseState.isFulfilled(result)).toBeTrue();
  });

  test('produces an instance which does not immediately call its function', async () => {
    let called = false;
    new Threadoid(() => {
      called = true;
    });

    expect(called).toBeFalse();
    await timers.setImmediate();
    expect(called).toBeFalse();
  });
});

describe('constructor(<invalid>)', () => {
  test.each([
    [null],
    [false],
    [[]],
    [''],
    ['bogus'],
    [['a']],
    [{}],
    [{ a: 10 }],
    [new Map()],
    [class NotACallableFunction {}]
  ])('fails for %p', (value) => {
    expect(() => new Threadoid(value)).toThrow();
  });
});

describe('isRunning()', () => {
  test('returns `false` before being started', async () => {
    const thread = new Threadoid(() => null);
    expect(thread.isRunning()).toBeFalse();
  });

  test('returns `true` immediately after being started', async () => {
    const thread = new Threadoid(() => null);

    const runResult = thread.run();
    expect(thread.isRunning()).toBeTrue();
    thread.stop();

    await expect(runResult).toResolve();
  });

  test('returns `true` while running', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    for (let i = 0; i < 10; i++) {
      await timers.setImmediate();
      expect(thread.isRunning()).toBeTrue();
    }

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns `true` while running, even if `stop()` was called', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

    // The actual test.
    thread.stop();
    expect(thread.isRunning()).toBeTrue();
    await timers.setImmediate();
    expect(thread.isRunning()).toBeTrue();

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns `false` after the main function runs to completion', async () => {
    let shouldRun = true;
    let stopped   = false;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
      stopped = true;
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

    // The actual test.

    shouldRun = false;
    for (let i = 0; (i < 10) && !stopped; i++) {
      await timers.setImmediate();
    }

    expect(thread.isRunning()).toBeFalse();
    expect(stopped).toBeTrue();

    await expect(runResult).toResolve();
  });
});

describe('run()', () => {
  describe.each`
    useStartFunc | label
    ${false}     | ${'without a start function'}
    ${true}      | ${'with a start function'}
  `('$label', ({ useStartFunc }) => {
    const startArg = useStartFunc
      ? [() => null]
      : [];

    test('causes the main function to be called', async () => {
      let called = false;
      const thread = new Threadoid(...startArg, () => {
        called = true;
      });

      const runResult = thread.run();
      await timers.setImmediate();
      expect(called).toBeTrue();

      await expect(runResult).toResolve();
    });

    test('causes the main function to be called, fully asynchronously', async () => {
      let called = false;
      const thread = new Threadoid(...startArg, () => {
        called = true;
      });

      const runResult = thread.run();
      expect(called).toBeFalse();
      await timers.setImmediate();
      expect(called).toBeTrue();

      await expect(runResult).toResolve();
    });

    test('causes the main function to be called, with the thread as its argument', async () => {
      let gotArgs = null;
      const thread = new Threadoid(...startArg, (...args) => {
        gotArgs = args;
      });

      const runResult = thread.run();
      await timers.setImmediate();
      expect(gotArgs).toStrictEqual([thread]);

      await expect(runResult).toResolve();
    });

    test('causes the main function to be called, with `this` unbound', async () => {
      let gotThis = null;
      const thread = new Threadoid(...startArg, function () {
        gotThis = this;
      });

      const runResult = thread.run();
      await timers.setImmediate();
      expect(gotThis).toBeUndefined();

      await expect(runResult).toResolve();
    });

    test('returns the value returned by the main function', async () => {
      const value = 'OH YEAH';
      const thread = new Threadoid(...startArg, () => value);

      const runResult = thread.run();
      expect(await runResult).toBe(value);
    });

    test('throws the value thrown by the main function', async () => {
      const error = new Error('OH NOES!!!');
      const thread = new Threadoid(...startArg, () => {
        throw (error);
      });

      const runResult = thread.run();
      expect(runResult).rejects.toThrow(error);
    });

    describe('when called while already running', () => {
      test('does not call the main function more than once', async () => {
        let shouldRun = true;
        let count     = 0;
        const thread = new Threadoid(...startArg, async () => {
          count++;
          while (shouldRun) {
            await timers.setImmediate();
          }
        });

        const runResult1 = thread.run();
        await timers.setImmediate();
        expect(count).toBe(1);

        const runResult2 = thread.run();
        await timers.setImmediate();
        expect(count).toBe(1);

        const runResult3 = thread.run();
        await timers.setImmediate();
        expect(count).toBe(1);

        shouldRun = false;
        await expect(runResult1).toResolve();
        await expect(runResult2).toResolve();
        await expect(runResult3).toResolve();
        expect(count).toBe(1);
      });

      test('returns the same value from all calls during the same run', async () => {
        let shouldRun = true;
        let count     = 0;
        const thread = new Threadoid(...startArg, async () => {
          count++;
          const result = `count-was-${count}`;
          while (shouldRun) {
            await timers.setImmediate();
          }

          return result;
        });

        const runResult1 = thread.run();
        const runResult2 = thread.run();
        await timers.setImmediate();
        const runResult3 = thread.run();

        shouldRun = false;
        expect(await runResult1).toBe('count-was-1');
        expect(await runResult2).toBe('count-was-1');
        expect(await runResult3).toBe('count-was-1');
      });

      test('causes a second run after a first run completes', async () => {
        let shouldRun = true;
        let count     = 0;
        const thread = new Threadoid(...startArg, async () => {
          count++;
          const result = `count-was-${count}`;
          while (shouldRun) {
            await timers.setImmediate();
          }

          return result;
        });

        const runResult1 = thread.run();
        await timers.setImmediate();
        shouldRun = false;
        await timers.setImmediate();
        expect(thread.isRunning()).toBeFalse(); // Baseline expectation.

        shouldRun = true;
        const runResult2 = thread.run();
        await timers.setImmediate();
        expect(thread.isRunning()).toBeTrue();
        shouldRun = false;
        await timers.setImmediate();
        expect(thread.isRunning()).toBeFalse();

        expect(await runResult1).toBe('count-was-1');
        expect(await runResult2).toBe('count-was-2');
      });
    });
  });
});

// These are extra tests for `run()` with a start function. The `describe()`s
// here are set up so the tests get reported sensibly with the ones above.
describe('run()', () => {
  describe('with a start function', () => {
    test('causes the start function to be called, fully asynchronously', async () => {
      let called = false;
      const thread = new Threadoid(() => { called = true; }, () => null);

      const runResult = thread.run();
      expect(called).toBeFalse();
      await timers.setImmediate();
      expect(called).toBeTrue();

      await expect(runResult).toResolve();
    });

    test('causes the start function to be called, with the thread as its argument', async () => {
      let gotArgs = null;
      const thread = new Threadoid((...args) => { gotArgs = args; }, () => null);

      const runResult = thread.run();
      await timers.setImmediate();
      expect(gotArgs).toStrictEqual([thread]);

      await expect(runResult).toResolve();
    });

    test('causes the start function to be called, with `this` unbound', async () => {
      let gotThis = null;
      const thread = new Threadoid(function () { gotThis = this; }, () => null);

      const runResult = thread.run();
      await timers.setImmediate();
      expect(gotThis).toBeUndefined();

      await expect(runResult).toResolve();
    });

    test('throws the value thrown by the start function', async () => {
      const error = new Error('OH NOES!!!');
      const wrongError = new Error('wrong-error');
      const thread = new Threadoid(
        () => { throw (error); },
        () => { throw (wrongError); }
      );

      const runResult = thread.run();
      expect(runResult).rejects.toThrow(error);
    });

    describe('when called while already running', () => {
      test('does not call the start function more than once', async () => {
        let shouldRun = true;
        let count     = 0;
        const startFn = async () => {
          count++;
          while (shouldRun) {
            await timers.setImmediate();
          }
        };
        const thread = new Threadoid(startFn, () => null);

        const runResult1 = thread.run();
        await timers.setImmediate();
        expect(count).toBe(1);

        const runResult2 = thread.run();
        await timers.setImmediate();
        expect(count).toBe(1);

        const runResult3 = thread.run();
        await timers.setImmediate();
        expect(count).toBe(1);

        shouldRun = false;
        await expect(runResult1).toResolve();
        await expect(runResult2).toResolve();
        await expect(runResult3).toResolve();
        expect(count).toBe(1);
      });
    });
  });
});

describe('shouldStop()', () => {
  test('returns `true` before being started', async () => {
    const thread = new Threadoid(() => null);
    expect(thread.shouldStop()).toBeTrue();
  });

  test('returns `false` immediately after being started', async () => {
    const thread = new Threadoid(() => null);

    const runResult = thread.run();
    expect(thread.shouldStop()).toBeFalse();
    thread.stop();

    await expect(runResult).toResolve();
  });

  test('returns `false` while running and not asked to stop', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    for (let i = 0; i < 10; i++) {
      await timers.setImmediate();
      expect(thread.shouldStop()).toBeFalse();
    }

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns `true` after the main function runs to completion', async () => {
    let shouldRun = true;
    let stopped   = false;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
      stopped = true;
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(thread.shouldStop()).toBeFalse(); // Baseline expectation.

    // The actual test.

    shouldRun = false;
    for (let i = 0; (i < 10) && !stopped; i++) {
      await timers.setImmediate();
    }

    expect(thread.shouldStop()).toBeTrue();
    expect(stopped).toBeTrue();

    await expect(runResult).toResolve();
  });
});

describe('stop()', () => {
  test('trivially succeeds when called on a non-running instance', () => {
    const thread = new Threadoid(() => null);
    expect(() => thread.stop()).not.toThrow();
  });

  test('returns `null` when called on a non-running instance', async () => {
    const thread = new Threadoid(() => null);
    const result = thread.stop();
    expect(await result).toBeNull();
  });

  test('synchronously causes `shouldStop()` to start returning `true`', async () => {
    let stopped = false;
    const thread = new Threadoid(async () => {
      while (!thread.shouldStop()) {
        await timers.setImmediate();
      }
      stopped = true;
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(thread.shouldStop()).toBeFalse(); // Baseline expectation.

    // The actual test.

    thread.stop();
    expect(thread.shouldStop()).toBeTrue();
    await timers.setImmediate();
    expect(thread.shouldStop()).toBeTrue();
    expect(stopped).toBeTrue();

    await expect(runResult).toResolve();
  });

  test('causes already-pending `whenStopRequested()` to become fulfilled', async () => {
    const thread = new Threadoid(async () => {
      await thread.whenStopRequested();
    });

    const runResult     = thread.run();
    const resultPromise = thread.whenStopRequested();
    await timers.setImmediate();

    // Baseline expectation.
    expect(PromiseState.isSettled(resultPromise)).toBeFalse();

    // The actual test.

    thread.stop();
    await timers.setImmediate();
    expect(PromiseState.isSettled(resultPromise)).toBeTrue();

    await expect(runResult).toResolve();
  });

  test('does not cause `isRunning()` to become `false`, per se', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

    // The actual test.

    thread.stop();
    for (let i = 0; i < 10; i++) {
      expect(thread.isRunning()).toBeTrue();
      await timers.setImmediate();
    }

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns the result of the corresponding `run()`', async () => {
    const value = 'Gee howdy!';
    const thread = new Threadoid(() => value);

    const runResult = thread.run();
    const result    = thread.stop();

    await timers.setImmediate();
    await expect(runResult).toResolve();
    expect(await result).toBe(value);
  });

  test('throws the error of the corresponding `run()`', async () => {
    const error = new Error('Aw shucks...');
    const thread = new Threadoid(() => { throw error; });

    const runResult = thread.run();
    const result    = thread.stop();

    PromiseUtil.handleRejection(runResult);
    PromiseUtil.handleRejection(result);

    await timers.setImmediate();
    await expect(runResult).toReject();
    await expect(result).rejects.toThrow(error);
  });
});

describe('whenStarted()', () => {
  describe.each`
    useStartFunc | label
    ${false}     | ${'without a start function'}
    ${true}      | ${'with a start function'}
  `('$label', ({ useStartFunc }) => {
    const startArg = useStartFunc
      ? [() => null]
      : [];

    test('is synchronously fulfilled as `null` before being started', async () => {
      const thread = new Threadoid(...startArg, () => null);
      const result = thread.whenStarted();
      expect(PromiseState.isFulfilled(result)).toBeTrue();
      expect(await result).toBeNull();
    });

    test('is not settled immediately after being started (before any async action can happen)', async () => {
      const thread = new Threadoid(...startArg, () => null);

      const runResult = thread.run();
      const result = thread.whenStarted();
      expect(PromiseState.isSettled(result)).toBeFalse();
      thread.stop();

      await expect(runResult).toResolve();
    });

    test('becomes resolved while running', async () => {
      let shouldRun = true;
      const thread = new Threadoid(...startArg, async () => {
        while (shouldRun) {
          await timers.setImmediate();
        }
      });

      const runResult = thread.run();
      for (let i = 0; i < 10; i++) {
        const result = thread.whenStarted();
        await timers.setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
      }

      shouldRun = false;
      await expect(runResult).toResolve();
    });

    test('becomes resolved while running, even if `stop()` was called', async () => {
      let shouldRun = true;
      const thread = new Threadoid(...startArg, async () => {
        while (shouldRun) {
          await timers.setImmediate();
        }
      });

      const runResult = thread.run();
      await timers.setImmediate();
      await expect(thread.whenStarted()).toResolve(); // Baseline expectation.

      // The actual test.
      thread.stop();
      const result1 = thread.whenStarted();
      await timers.setImmediate();
      const result2 = thread.whenStarted();

      await expect(result1).toResolve();
      await expect(result2).toResolve();

      shouldRun = false;
      await expect(runResult).toResolve();

    });

    test('becomes synchronously fulfilled as `null` after the main function runs to completion', async () => {
      let shouldRun = true;
      let stopped   = false;
      const thread = new Threadoid(...startArg, async () => {
        while (shouldRun) {
          await timers.setImmediate();
        }
        stopped = true;
      });

      const runResult = thread.run();
      await timers.setImmediate();
      await expect(thread.whenStarted()).toResolve(); // Baseline expectation.

      // The actual test.

      shouldRun = false;
      for (let i = 0; (i < 10) && !stopped; i++) {
        await timers.setImmediate();
      }

      const result = thread.whenStarted();
      expect(PromiseState.isFulfilled(result)).toBeTrue();
      expect(stopped).toBeTrue();
      expect(await result).toBeNull();

      await expect(runResult).toResolve();
    });

    if (useStartFunc) {
      test('does not resolve before the start function has completed but does immediately after', async () => {
        let shouldRunStart = true;
        const startFn = async () => {
          while (shouldRunStart) {
            await timers.setImmediate();
          }
        };
        let shouldRunMain = true;
        const mainFn = async () => {
          while (shouldRunMain) {
            await timers.setImmediate();
          }
        };
        const thread = new Threadoid(startFn, mainFn);

        const runResult = thread.run();
        await timers.setImmediate();
        expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

        // Actual test.
        const result = thread.whenStarted();
        expect(PromiseState.isSettled(result)).toBeFalse();
        shouldRunStart = false;
        await timers.setImmediate();
        expect(PromiseState.isFulfilled(result)).toBeTrue();
        await expect(result).toResolve();

        shouldRunMain = false;
        await expect(runResult).toResolve();
      });
    } else {
      test('resolves immediately when starting to run asynchronously', async () => {
        let shouldRun = true;
        let isRunning = false;
        const thread = new Threadoid(async () => {
          isRunning = true;
          while (shouldRun) {
            await timers.setImmediate();
          }
        });

        const runResult = thread.run();
        const result = thread.whenStarted();
        while (!isRunning) {
          await timers.setImmediate();
        }
        expect(PromiseState.isFulfilled(result)).toBeTrue();
        shouldRun = false;
        thread.stop();

        await expect(runResult).toResolve();
      });
    }
  });
});

describe('whenStopRequested()', () => {
  test('is a pre-resolved promise when not running', () => {
    const thread = new Threadoid(() => null);
    const result = thread.whenStopRequested();

    expect(PromiseState.isFulfilled(result)).toBeTrue();
  });

  test('is a pending promise when running, before being asked to stop', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    const result    = thread.whenStopRequested();

    expect(PromiseState.isPending(result)).toBeTrue();
    await timers.setImmediate();
    expect(PromiseState.isPending(result)).toBeTrue();

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('is promise which resolves, after being asked to stop', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    const result    = thread.whenStopRequested();

    expect(PromiseState.isPending(result)).toBeTrue(); // Baseline expectation.

    // The actual test.
    thread.stop();
    await timers.setImmediate();
    expect(PromiseState.isFulfilled(result)).toBeTrue();

    shouldRun = false;
    await expect(runResult).toResolve();
  });
});
