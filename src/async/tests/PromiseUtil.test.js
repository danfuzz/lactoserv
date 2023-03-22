// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process';
import * as timers from 'node:timers/promises';

import { ManualPromise, PromiseState, PromiseUtil } from '@this/async';


const wasHandled = async (promise) => {
  // Unclear that there's a way to test this such that a failure will be 100%
  // detected _during_ the test. So, when this test is broken, it might show
  // up as a failure right here, _or_ it might show up as the test runner
  // complaining generally about an unhandled rejection. YMMV.

  let gotCalled = false;
  const listener = (reason_unused, p) => {
    if (p === promise) {
      gotCalled = true;
    }
  };

  process.on('unhandledRejection', listener);
  await timers.setImmediate();
  await timers.setImmediate();
  await timers.setImmediate();
  await timers.setImmediate();
  await timers.setImmediate();
  process.removeListener('unhandledRejection', listener);

  return !gotCalled;
};

describe('handleRejection()', () => {
  test('does indeed handle the rejection', async () => {
    const error = new Error('erroneous-monk');
    const prom  = Promise.reject(error);

    PromiseUtil.handleRejection(prom);
    expect(await wasHandled(prom)).toBeTrue();
  });
});

describe('rejectAndHandle()', () => {
  test('makes a rejected promise with the given reason', async () => {
    const error = new Error('erroneous-monk');
    const prom = PromiseUtil.rejectAndHandle(error);

    expect(PromiseState.isRejected(prom)).toBeTrue();
    await expect(prom).rejects.toBe(error);
  });

  test('makes a handled rejection', async () => {
    const error = new Error('erroneous-monk');
    const prom  = PromiseUtil.rejectAndHandle(error);
    expect(await wasHandled(prom)).toBeTrue();
  });
});

describe('race()', () => {
  test('never settles, given an empty array', async () => {
    const result = PromiseUtil.race([]);

    expect(PromiseState.isSettled(result)).toBeFalse();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeFalse();
  });

  test.each`
  value
  ${null}
  ${'boop'}
  ${123}
  `('settles promptly given $value amongst unsettled promises', async ({ value }) => {
    const result = PromiseUtil.race([
      new ManualPromise().promise,
      value,
      new ManualPromise().promise
    ]);

    expect(PromiseState.isSettled(result)).toBeFalse();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    expect(await result).toBe(value);
  });

  test('settles promptly with an already-resolved promise', async () => {
    const value  = ['florp'];
    const result = PromiseUtil.race([
      new ManualPromise().promise,
      Promise.resolve(value),
      new ManualPromise().promise
    ]);

    expect(PromiseState.isSettled(result)).toBeFalse();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    expect(await result).toBe(value);
  });

  test('settles promptly with an already-rejected promise', async () => {
    const rejected = PromiseUtil.rejectAndHandle(new Error('unflorpy'));
    const result   = PromiseUtil.race([
      new ManualPromise().promise,
      rejected,
      new ManualPromise().promise
    ]);

    PromiseUtil.handleRejection(result);
    expect(PromiseState.isSettled(result)).toBeFalse();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    await expect(result).toReject();
  });

  test('settles when a promise becomes resolved', async () => {
    const mp     = new ManualPromise();
    const value  = ['zonk'];
    const result = PromiseUtil.race([
      new ManualPromise().promise,
      mp.promise,
      new ManualPromise().promise
    ]);

    expect(PromiseState.isSettled(result)).toBeFalse();
    mp.resolve(value);
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    expect(await result).toBe(value);
  });

  test('settles when a promise becomes rejected', async () => {
    const mp     = new ManualPromise();
    const error  = new Error('eepers!');
    const result = PromiseUtil.race([
      new ManualPromise().promise,
      mp.promise,
      new ManualPromise().promise
    ]);

    PromiseUtil.handleRejection(result);
    expect(PromiseState.isSettled(result)).toBeFalse();
    mp.rejectAndHandle(error);
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    await expect(result).toReject();
  });
});
