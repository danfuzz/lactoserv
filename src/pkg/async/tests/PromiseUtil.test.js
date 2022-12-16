// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process';
import * as timers from 'node:timers/promises';

import { PromiseState, PromiseUtil } from '@this/async';


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

describe('handleRejection', () => {
  test('does indeed handle the rejection', async () => {
    const error = new Error('erroneous-monk');
    const prom  = Promise.reject(error);

    PromiseUtil.handleRejection(prom);
    expect(await wasHandled(prom)).toBeTrue();
  });
});

describe('rejectAndHandle', () => {
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
