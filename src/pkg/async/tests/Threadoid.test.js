// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { PromiseState, Threadoid } from '@this/async';

import * as timers from 'node:timers/promises';

describe('constructor(function)', () => {
  test('trivially succeeds', () => {
    expect(() => new Threadoid(() => null)).not.toThrow();
  });

  test('produces an instance for which `isRunning() === false`', () => {
    const thread = new Threadoid(() => null);

    expect(thread.isRunning()).toBeFalse();
  });

  test('produces an instance for which `isStarted() === false`', () => {
    const thread = new Threadoid(() => null);

    expect(thread.isStarted()).toBeFalse();
  });

  test('produces an instance for which `shouldStop() === true`', () => {
    const thread = new Threadoid(() => null);

    expect(thread.shouldStop()).toBeTrue();
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

  test('returns `false` after the thread function runs to completion', async () => {
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

describe('isStarted()', () => {
  test('returns `false` before being started', async () => {
    const thread = new Threadoid(() => null);
    expect(thread.isStarted()).toBeFalse();
  });

  test('returns `false` immediately after being started (before any async action can happen)', async () => {
    const thread = new Threadoid(() => null);

    const runResult = thread.run();
    expect(thread.isStarted()).toBeFalse();
    thread.stop();

    await expect(runResult).toResolve();
  });

  test('returns `true` immediately when starting to run asynchronously', async () => {
    let shouldRun = true;
    const thread = new Threadoid(async () => {
      while (shouldRun) {
        await timers.setImmediate();
      }
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(thread.isStarted()).toBeTrue();
    shouldRun = false;
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
      expect(thread.isStarted()).toBeTrue();
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
    expect(thread.isStarted()).toBeTrue(); // Baseline expectation.

    // The actual test.
    thread.stop();
    expect(thread.isStarted()).toBeTrue();
    await timers.setImmediate();
    expect(thread.isStarted()).toBeTrue();

    shouldRun = false;
    await expect(runResult).toResolve();
  });

  test('returns `false` after the thread function runs to completion', async () => {
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
    expect(thread.isStarted()).toBeTrue(); // Baseline expectation.

    // The actual test.

    shouldRun = false;
    for (let i = 0; (i < 10) && !stopped; i++) {
      await timers.setImmediate();
    }

    expect(thread.isStarted()).toBeFalse();
    expect(stopped).toBeTrue();

    await expect(runResult).toResolve();
  });
});

describe('run()', () => {
  test('causes the thread function to be called', async () => {
    let called = false;
    const thread = new Threadoid(() => {
      called = true;
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(called).toBeTrue();

    await expect(runResult).toResolve();
  });

  test('causes the thread function to be called, fully asynchronously', async () => {
    let called = false;
    const thread = new Threadoid(() => {
      called = true;
    });

    const runResult = thread.run();
    expect(called).toBeFalse();
    await timers.setImmediate();
    expect(called).toBeTrue();

    await expect(runResult).toResolve();
  });

  test('causes the thread function to be called, with the thread as its argument', async () => {
    let gotArgs = null;
    const thread = new Threadoid((...args) => {
      gotArgs = args;
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(gotArgs).toStrictEqual([thread]);

    await expect(runResult).toResolve();
  });

  test('causes the thread function to be called, with `this` unbound', async () => {
    let gotThis = null;
    const thread = new Threadoid(function () {
      gotThis = this;
    });

    const runResult = thread.run();
    await timers.setImmediate();
    expect(gotThis).toBeNull();

    await expect(runResult).toResolve();
  });

  describe('when called while already running', () => {
    test('does not call the thread function more than once', async () => {
      let shouldRun = true;
      let count     = 0;
      const thread = new Threadoid(async () => {
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

    test('returns the same value from all calls', async () => {
      let shouldRun = true;
      let count     = 0;
      const thread = new Threadoid(async () => {
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

  test('returns `true` after the thread function runs to completion', async () => {
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

  test('causes `shouldStop()` to start returning `true`', async () => {
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
