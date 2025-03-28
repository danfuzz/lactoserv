// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { ManualPromise, PromiseState, PromiseUtil, Threadlet }
  from '@this/async';


describe('constructor(function)', () => {
  test('trivially succeeds', () => {
    expect(() => new Threadlet(() => null)).not.toThrow();
  });

  test('produces an instance for which `isRunning() === false`', () => {
    const thread = new Threadlet(() => null);

    expect(thread.isRunning()).toBeFalse();
  });

  test('produces an instance for which `whenStarted()` is synchronously fulfilled', async () => {
    const thread = new Threadlet(() => null);
    const result = thread.whenStarted();

    expect(PromiseState.isFulfilled(result)).toBeTrue();
  });

  test('produces an instance which does not immediately call its function', async () => {
    let called = false;
    new Threadlet(() => {
      called = true;
    });

    expect(called).toBeFalse();
    await setImmediate();
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
    expect(() => new Threadlet(value)).toThrow();
  });
});

describe('isRunning()', () => {
  test('returns `false` before being started', async () => {
    const thread = new Threadlet(() => null);
    expect(thread.isRunning()).toBeFalse();
  });

  test('returns `true` immediately after being started', async () => {
    const thread = new Threadlet(() => null);

    const runResult = thread.run();
    expect(thread.isRunning()).toBeTrue();
    thread.stop();

    await expect(runResult).toResolve();
  });

  test('returns `true` while running', async () => {
    let shouldRun = true;
    const thread = new Threadlet(async () => {
      while (shouldRun) {
        await setImmediate();
      }
    });

    const runResult = thread.run();
    for (let i = 0; i < 10; i++) {
      await setImmediate();
      expect(thread.isRunning()).toBeTrue();
    }

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns `true` while running, even if `stop()` was called', async () => {
    let shouldRun = true;
    const thread = new Threadlet(async () => {
      while (shouldRun) {
        await setImmediate();
      }
    });

    const runResult = thread.run();
    await setImmediate();
    expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

    // The actual test.
    thread.stop();
    expect(thread.isRunning()).toBeTrue();
    await setImmediate();
    expect(thread.isRunning()).toBeTrue();

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns `false` after the main function runs to completion', async () => {
    let shouldRun = true;
    let stopped   = false;
    const thread = new Threadlet(async () => {
      while (shouldRun) {
        await setImmediate();
      }
      stopped = true;
    });

    const runResult = thread.run();
    await setImmediate();
    expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

    // The actual test.

    shouldRun = false;
    for (let i = 0; (i < 10) && !stopped; i++) {
      await setImmediate();
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
      const thread = new Threadlet(...startArg, () => {
        called = true;
      });

      const runResult = thread.run();
      await setImmediate();
      expect(called).toBeTrue();

      await expect(runResult).toResolve();
    });

    test('causes the main function to be called, fully asynchronously', async () => {
      let called = false;
      const thread = new Threadlet(...startArg, () => {
        called = true;
      });

      const runResult = thread.run();
      expect(called).toBeFalse();
      await setImmediate();
      expect(called).toBeTrue();

      await expect(runResult).toResolve();
    });

    test('causes the main function to be called, with an appropriate access object as its argument', async () => {
      let gotArgs = null;
      const thread = new Threadlet(...startArg, (...args) => {
        gotArgs = args;
      });

      const runResult = thread.run();
      await setImmediate();
      expect(gotArgs).toBeArrayOfSize(1);
      const gotArg = gotArgs[0];
      expect(gotArg).toBeInstanceOf(Threadlet.RunnerAccess);
      expect(gotArg.threadlet).toBe(thread);

      await expect(runResult).toResolve();
    });

    test('causes the main function to be called, with `this` unbound', async () => {
      let gotThis = null;
      const thread = new Threadlet(...startArg, function () {
        gotThis = this;
      });

      const runResult = thread.run();
      await setImmediate();
      expect(gotThis).toBeUndefined();

      await expect(runResult).toResolve();
    });

    test('returns the value returned by the main function', async () => {
      const value = 'OH YEAH';
      const thread = new Threadlet(...startArg, () => value);

      const runResult = thread.run();
      expect(await runResult).toBe(value);
    });

    test('throws the value thrown by the main function', async () => {
      const error = new Error('OH NOES!!!');
      const thread = new Threadlet(...startArg, () => {
        throw (error);
      });

      const runResult = thread.run();
      expect(runResult).rejects.toThrow(error);
    });

    describe('when called while already running', () => {
      test('does not call the main function more than once', async () => {
        let shouldRun = true;
        let count     = 0;
        const thread = new Threadlet(...startArg, async () => {
          count++;
          while (shouldRun) {
            await setImmediate();
          }
        });

        const runResult1 = thread.run();
        await setImmediate();
        expect(count).toBe(1);

        const runResult2 = thread.run();
        await setImmediate();
        expect(count).toBe(1);

        const runResult3 = thread.run();
        await setImmediate();
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
        const thread = new Threadlet(...startArg, async () => {
          count++;
          const result = `count-was-${count}`;
          while (shouldRun) {
            await setImmediate();
          }

          return result;
        });

        const runResult1 = thread.run();
        const runResult2 = thread.run();
        await setImmediate();
        const runResult3 = thread.run();

        shouldRun = false;
        expect(await runResult1).toBe('count-was-1');
        expect(await runResult2).toBe('count-was-1');
        expect(await runResult3).toBe('count-was-1');
      });

      test('causes a second run after a first run completes', async () => {
        let shouldRun = true;
        let count     = 0;
        const thread = new Threadlet(...startArg, async () => {
          count++;
          const result = `count-was-${count}`;
          while (shouldRun) {
            await setImmediate();
          }

          return result;
        });

        const runResult1 = thread.run();
        await setImmediate();
        shouldRun = false;
        await setImmediate();
        expect(thread.isRunning()).toBeFalse(); // Baseline expectation.

        shouldRun = true;
        const runResult2 = thread.run();
        await setImmediate();
        expect(thread.isRunning()).toBeTrue();
        shouldRun = false;
        await setImmediate();
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
      const thread = new Threadlet(() => { called = true; }, () => null);

      const runResult = thread.run();
      expect(called).toBeFalse();
      await setImmediate();
      expect(called).toBeTrue();

      await expect(runResult).toResolve();
    });

    test('causes the start function to be called, with an appropriate access object as its argument', async () => {
      let gotArgs = null;
      const thread = new Threadlet((...args) => { gotArgs = args; }, () => null);

      const runResult = thread.run();
      await setImmediate();
      expect(gotArgs).toBeArrayOfSize(1);
      const gotArg = gotArgs[0];
      expect(gotArg).toBeInstanceOf(Threadlet.RunnerAccess);
      expect(gotArg.threadlet).toBe(thread);

      await expect(runResult).toResolve();
    });

    test('causes the start function to be called, with `this` unbound', async () => {
      let gotThis = null;
      const thread = new Threadlet(function () { gotThis = this; }, () => null);

      const runResult = thread.run();
      await setImmediate();
      expect(gotThis).toBeUndefined();

      await expect(runResult).toResolve();
    });

    test('throws the value thrown by the start function', async () => {
      const error = new Error('OH NOES!!!');
      const wrongError = new Error('wrong-error');
      const thread = new Threadlet(
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
            await setImmediate();
          }
        };
        const thread = new Threadlet(startFn, () => null);

        const runResult1 = thread.run();
        await setImmediate();
        expect(count).toBe(1);

        const runResult2 = thread.run();
        await setImmediate();
        expect(count).toBe(1);

        const runResult3 = thread.run();
        await setImmediate();
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

describe('start()', () => {
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
      const thread = new Threadlet(...startArg, () => {
        called = true;
      });

      const result = thread.start();
      await setImmediate();
      expect(called).toBeTrue();

      await expect(result).toResolve();
    });

    test('returns once the main function is running', async () => {
      let shouldRun = true;
      const thread = new Threadlet(...startArg, async () => {
        while (shouldRun) {
          await setImmediate();
        }
      });

      const result = thread.start();
      await setImmediate();
      expect(PromiseState.isFulfilled(result)).toBeTrue();

      shouldRun = false;
      await expect(thread.stop()).toResolve();
    });
  });
});

// These are extra tests for `start()` with a start function. The `describe()`s
// here are set up so the tests get reported sensibly with the ones above.
describe('start()', () => {
  describe('with a start function', () => {
    test('returns the return value from the start function', async () => {
      const thread = new Threadlet(() => 123, () => null);

      const result = thread.start();
      await expect(result).resolves.toBe(123);
    });

    test('throws the error thrown from the start function', async () => {
      const error  = new Error('oh tragedy');
      const thread = new Threadlet(() => { throw error; }, () => null);

      const result = thread.start();
      await expect(result).rejects.toThrow(error);
    });
  });
});

describe('stop()', () => {
  test('trivially succeeds when called on a non-running instance', () => {
    const thread = new Threadlet(() => null);
    expect(() => thread.stop()).not.toThrow();
  });

  test('returns `null` when called on a non-running instance', async () => {
    const thread = new Threadlet(() => null);
    const result = thread.stop();
    expect(await result).toBeNull();
  });

  test('synchronously causes `runnerAccess.shouldStop()` to start returning `true`', async () => {
    let runnerAccess = null;
    let stopped      = false;
    const thread = new Threadlet(async (ra) => {
      runnerAccess = ra;
      while (!runnerAccess.shouldStop()) {
        await setImmediate();
      }
      stopped = true;
    });

    const runResult = thread.run();

    while (!runnerAccess) {
      await setImmediate();
    }

    expect(runnerAccess.shouldStop()).toBeFalse(); // Baseline expectation.

    // The actual test.

    thread.stop();
    expect(runnerAccess.shouldStop()).toBeTrue();
    await setImmediate();
    expect(runnerAccess.shouldStop()).toBeTrue();
    expect(stopped).toBeTrue();

    await expect(runResult).toResolve();
  });

  test('causes already-pending `runnerAccess.whenStopRequested()` to become fulfilled', async () => {
    let runnerAccess = null;
    const thread = new Threadlet(async (ra) => {
      runnerAccess = ra;
      await runnerAccess.whenStopRequested();
    });

    const runResult = thread.run();

    while (!runnerAccess) {
      await setImmediate();
    }

    const resultPromise = runnerAccess.whenStopRequested();

    // Baseline expectation.
    expect(PromiseState.isSettled(resultPromise)).toBeFalse();

    // The actual test.

    thread.stop();
    await setImmediate();
    expect(PromiseState.isSettled(resultPromise)).toBeTrue();

    await expect(runResult).toResolve();
  });

  test('does not cause `isRunning()` to become `false`, per se', async () => {
    let shouldRun = true;
    const thread = new Threadlet(async () => {
      while (shouldRun) {
        await setImmediate();
      }
    });

    const runResult = thread.run();
    await setImmediate();
    expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

    // The actual test.

    thread.stop();
    for (let i = 0; i < 10; i++) {
      expect(thread.isRunning()).toBeTrue();
      await setImmediate();
    }

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns the result of the corresponding `run()`', async () => {
    const value = 'Gee howdy!';
    const thread = new Threadlet(() => value);

    const runResult = thread.run();
    const result    = thread.stop();

    await setImmediate();
    await expect(runResult).toResolve();
    expect(await result).toBe(value);
  });

  test('throws the error of the corresponding `run()`', async () => {
    const error = new Error('Aw shucks...');
    const thread = new Threadlet(() => { throw error; });

    const runResult = thread.run();
    const result    = thread.stop();

    PromiseUtil.handleRejection(runResult);
    PromiseUtil.handleRejection(result);

    await setImmediate();
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
      const thread = new Threadlet(...startArg, () => null);
      const result = thread.whenStarted();
      expect(PromiseState.isFulfilled(result)).toBeTrue();
      expect(await result).toBeNull();
    });

    test('is not settled immediately after being started (before any async action can happen)', async () => {
      const thread = new Threadlet(...startArg, () => null);

      const runResult = thread.run();
      const result = thread.whenStarted();
      expect(PromiseState.isSettled(result)).toBeFalse();
      thread.stop();

      await expect(runResult).toResolve();
    });

    test('becomes resolved while running', async () => {
      let shouldRun = true;
      const thread = new Threadlet(...startArg, async () => {
        while (shouldRun) {
          await setImmediate();
        }
      });

      const runResult = thread.run();
      for (let i = 0; i < 10; i++) {
        const result = thread.whenStarted();
        await setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
      }

      shouldRun = false;
      await expect(runResult).toResolve();
    });

    test('becomes resolved while running, even if `stop()` was called', async () => {
      let shouldRun = true;
      const thread = new Threadlet(...startArg, async () => {
        while (shouldRun) {
          await setImmediate();
        }
      });

      const runResult = thread.run();
      await setImmediate();
      await expect(thread.whenStarted()).toResolve(); // Baseline expectation.

      // The actual test.
      thread.stop();
      const result1 = thread.whenStarted();
      await setImmediate();
      const result2 = thread.whenStarted();

      await expect(result1).toResolve();
      await expect(result2).toResolve();

      shouldRun = false;
      await expect(runResult).toResolve();
    });

    test('becomes synchronously fulfilled as `null` after the main function runs to completion', async () => {
      let shouldRun = true;
      let stopped   = false;
      const thread = new Threadlet(...startArg, async () => {
        while (shouldRun) {
          await setImmediate();
        }
        stopped = true;
      });

      const runResult = thread.run();
      await setImmediate();
      await expect(thread.whenStarted()).toResolve(); // Baseline expectation.

      // The actual test.

      shouldRun = false;
      for (let i = 0; (i < 10) && !stopped; i++) {
        await setImmediate();
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
            await setImmediate();
          }
        };
        let shouldRunMain = true;
        const mainFn = async () => {
          while (shouldRunMain) {
            await setImmediate();
          }
        };
        const thread = new Threadlet(startFn, mainFn);

        const runResult = thread.run();
        await setImmediate();
        expect(thread.isRunning()).toBeTrue(); // Baseline expectation.

        // Actual test.
        const result = thread.whenStarted();
        expect(PromiseState.isSettled(result)).toBeFalse();
        shouldRunStart = false;
        await setImmediate();
        expect(PromiseState.isFulfilled(result)).toBeTrue();
        await expect(result).toResolve();

        shouldRunMain = false;
        await expect(runResult).toResolve();
      });

      test('becomes resolved to whatever the start function returns', async () => {
        const thread = new Threadlet(() => 123, () => null);

        const runResult = thread.run();
        const result    = thread.whenStarted();

        await setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
        expect(await result).toBe(123);

        await expect(runResult).toResolve();
      });

      test('throws whatever the start function throws', async () => {
        const error  = new Error('alas');
        const thread = new Threadlet(() => { throw error; }, () => null);

        const runResult = thread.run();
        const result    = thread.whenStarted();

        PromiseUtil.handleRejection(result);
        PromiseUtil.handleRejection(runResult);

        await setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
        await expect(result).rejects.toThrow(error);

        await expect(runResult).rejects.toThrow();
      });
    } else {
      test('resolves immediately when starting to run asynchronously', async () => {
        let shouldRun = true;
        let isRunning = false;
        const thread = new Threadlet(async () => {
          isRunning = true;
          while (shouldRun) {
            await setImmediate();
          }
        });

        const runResult = thread.run();
        const result = thread.whenStarted();
        while (!isRunning) {
          await setImmediate();
        }
        expect(PromiseState.isFulfilled(result)).toBeTrue();
        shouldRun = false;
        thread.stop();

        await expect(runResult).toResolve();
      });

      test('becomes resolved to `null` once the thread is running', async () => {
        const thread = new Threadlet(async () => 123);

        const runResult = thread.run();
        const result    = thread.whenStarted();

        await setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
        expect(await result).toBeNull();

        await expect(runResult).toResolve();
      });
    }
  });
});

describe('`RunnerAccess` class', () => {
  test('is consistently the same instance for a given threadlet', async () => {
    const got = [];

    const thread = new Threadlet((ra) => got.push(ra), (ra) => got.push(ra));
    await thread.run();

    expect(got.length).toBe(2);
    expect(got[1]).toBe(got[0]);

    await thread.run();
    expect(got.length).toBe(4);
    expect(got[2]).toBe(got[0]);
    expect(got[3]).toBe(got[0]);
  });

  describe('raceWhenStopRequested()', () => {
    test('when running, promptly returns `false` if there is an already-resolved argument', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      const thread = new Threadlet(
        (ra) => { runnerAccess = ra; },
        async () => {
          while (shouldRun) {
            await setImmediate();
          }
        });

      await thread.start();
      const result = runnerAccess.raceWhenStopRequested([Promise.resolve('boop')]);

      expect(PromiseState.isSettled(result)).toBeFalse();
      await setImmediate();
      expect(PromiseState.isSettled(result)).toBeTrue();
      expect(await result).toBeFalse();

      shouldRun = false;
      await expect(thread.run()).toResolve();
    });

    test('when running, promptly throws if there is an already-rejected argument', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      const thread = new Threadlet(
        (ra) => { runnerAccess = ra; },
        async () => {
          while (shouldRun) {
            await setImmediate();
          }
        });

      await thread.start();
      const rejected = PromiseUtil.rejectAndHandle(new Error('oy!'));
      const result   = runnerAccess.raceWhenStopRequested([rejected]);

      PromiseUtil.handleRejection(result);
      expect(PromiseState.isSettled(result)).toBeFalse();
      await setImmediate();
      expect(PromiseState.isSettled(result)).toBeTrue();
      await expect(result).toReject();

      shouldRun = false;
      await expect(thread.run()).toResolve();
    });

    test('when running, returns `false` when an argument becomes resolved', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      const thread = new Threadlet(
        (ra) => { runnerAccess = ra; },
        async () => {
          while (shouldRun) {
            await setImmediate();
          }
        });

      await thread.start();

      const mp     = new ManualPromise();
      const result = runnerAccess.raceWhenStopRequested([mp.promise]);

      expect(PromiseState.isSettled(result)).toBeFalse();
      mp.resolve('boop');
      await setImmediate();
      expect(PromiseState.isSettled(result)).toBeTrue();
      expect(await result).toBeFalse();

      shouldRun = false;
      await expect(thread.run()).toResolve();
    });

    test('when running, throws when an argument becomes rejected', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      const thread = new Threadlet(
        (ra) => { runnerAccess = ra; },
        async () => {
          while (shouldRun) {
            await setImmediate();
          }
        });

      await thread.start();

      const mp     = new ManualPromise();
      const result = runnerAccess.raceWhenStopRequested([mp.promise]);

      PromiseUtil.handleRejection(result);
      expect(PromiseState.isSettled(result)).toBeFalse();
      mp.reject(new Error('eep!'));
      await setImmediate();
      expect(PromiseState.isSettled(result)).toBeTrue();
      await expect(result).toReject();

      shouldRun = false;
      await expect(thread.run()).toResolve();
    });

    test('when not running, promptly returns `true` when given no other arguments', async () => {
      let runnerAccess = null;
      const thread = new Threadlet(async (ra) => { runnerAccess = ra; });

      await thread.run();

      const result = runnerAccess.raceWhenStopRequested([]);

      await setImmediate();
      expect(PromiseState.isSettled(result)).toBeTrue();
      expect(await result).toBeTrue();
    });

    test('when not running, promptly returns `true` even given an unsettled argument', async () => {
      let runnerAccess = null;
      const thread = new Threadlet(async (ra) => { runnerAccess = ra; });

      await thread.run();

      const mp     = new ManualPromise();
      const result = runnerAccess.raceWhenStopRequested([mp.promise]);

      await setImmediate();
      expect(PromiseState.isSettled(result)).toBeTrue();
      expect(await result).toBeTrue();
    });
  });

  describe('shouldStop()', () => {
    test('returns `false` immediately after being started', async () => {
      let got = null;
      const thread = new Threadlet(
        (ra) => { got = ra.shouldStop(); },
        () => null);

      await thread.run();
      expect(got).toBeFalse();
      thread.stop();
    });

    test('returns `false` while running and not asked to stop', async () => {
      const got       = [];
      let   shouldRun = true;
      const thread = new Threadlet(async (ra) => {
        while (shouldRun) {
          got.push(ra.shouldStop());
          await setImmediate();
        }
      });

      const runResult = thread.run();
      for (let i = 0; i < 10; i++) {
        await setImmediate();
      }

      expect(got.length).not.toBe(0);
      for (const g of got) {
        expect(g).toBe(false);
      }

      shouldRun = false;
      await expect(runResult).toResolve();
    });

    test('returns `true` after the main function runs to completion', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      let stopped      = false;
      const thread = new Threadlet(async (ra) => {
        runnerAccess = ra;
        while (shouldRun) {
          await setImmediate();
        }
        stopped = true;
      });

      const runResult = thread.run();

      while (!runnerAccess) {
        await setImmediate();
      }

      expect(runnerAccess.shouldStop()).toBeFalse(); // Baseline expectation.

      // The actual test.

      shouldRun = false;
      for (let i = 0; (i < 10) && !stopped; i++) {
        await setImmediate();
      }

      expect(runnerAccess.shouldStop()).toBeTrue();
      expect(stopped).toBeTrue();

      await expect(runResult).toResolve();
    });
  });

  describe('whenStopRequested()', () => {
    test('is a pending promise when running, before being asked to stop', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      const thread = new Threadlet(async (ra) => {
        runnerAccess = ra;
        while (shouldRun) {
          await setImmediate();
        }
      });

      const runResult = thread.run();

      while (!runnerAccess) {
        await setImmediate();
      }

      const result = runnerAccess.whenStopRequested();

      expect(PromiseState.isPending(result)).toBeTrue();
      await setImmediate();
      expect(PromiseState.isPending(result)).toBeTrue();

      shouldRun = false;
      await expect(runResult).toResolve();
    });

    test('is promise which resolves, after being asked to stop but before having actually stopped', async () => {
      let runnerAccess = null;
      let shouldRun    = true;
      const thread = new Threadlet(async (ra) => {
        runnerAccess = ra;
        while (shouldRun) {
          await setImmediate();
        }
      });

      const runResult = thread.run();

      while (!runnerAccess) {
        await setImmediate();
      }

      const result = runnerAccess.whenStopRequested();

      expect(PromiseState.isPending(result)).toBeTrue(); // Baseline expectation.

      // The actual test.
      thread.stop();
      await setImmediate();
      expect(PromiseState.isFulfilled(result)).toBeTrue();

      shouldRun = false;
      await expect(runResult).toResolve();
    });

    test('is promise which resolves promptly, after the threadlet has stopped', async () => {
      let runnerAccess = null;
      const thread     = new Threadlet((ra) => { runnerAccess = ra; });

      await thread.run();

      const result = runnerAccess.whenStopRequested();

      expect(PromiseState.isFulfilled(result)).toBeTrue();
    });
  });
});
