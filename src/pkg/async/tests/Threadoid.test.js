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

  test('produces an instance for which `shouldStop() === true`', () => {
    const thread = new Threadoid(() => null);

    expect(thread.shouldStop()).toBeTrue();
  });

  test('produces an instance for which `whenStopRequested()` is pre-fulfilled', async () => {
    const thread = new Threadoid(() => null);

    const result = thread.whenStopRequested();
    expect(PromiseState.isFulfilled(result)).toBeTrue();
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

  test.skip('returns `true` after the thread function runs to completion', async () => {
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
  // TODO
});

describe('whenStopRequested()', () => {
  // TODO
});
