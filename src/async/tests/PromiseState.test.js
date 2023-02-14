// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PromiseState } from '@this/async';


const promPending   = new Promise(() => { /*empty*/ });
const promFulfilled = Promise.resolve(123);
const promRejected  = Promise.reject(new Error('Eeeek!'));

promPending.testState   = 'pending';
promFulfilled.testState = 'fulfilled';
promRejected.testState  = 'rejected';

// Make sure `promRejected` doesn't turn into an unhandled promise rejection.
(async () => {
  try {
    await promRejected;
  } catch {
    // Ignore it.
  }
})();

describe('of', () => {
  test.each`
    promise
    ${promFulfilled}
    ${promPending}
    ${promRejected}
  `('$promise.testState instance', ({ promise }) => {
    expect(PromiseState.of(promise)).toBe(promise.testState);
  });

  test.each(
    [[null], [undefined], ['florp'], [{ a: 10 }]]
  )('invalid: %p', (value) => {
    expect(() => PromiseState.of(value)).toThrow();
  });
});

describe.each`
  promise          | isFulfilled | isPending | isRejected | isSettled
  ${promFulfilled} | ${true}     | ${false}  | ${false}   | ${true}
  ${promPending}   | ${false}    | ${true}   | ${false}   | ${false}
  ${promRejected}  | ${false}    | ${false}  | ${true}    | ${true}
`('$promise.testState instance', ({ promise, isFulfilled, isPending, isRejected, isSettled }) => {
  test.each`
    method           | expected
    ${'isFulfilled'} | ${isFulfilled}
    ${'isPending'}   | ${isPending}
    ${'isRejected'}  | ${isRejected}
    ${'isSettled'}   | ${isSettled}
  `('$method() returns $expected', ({ method, expected }) => {
    const result = PromiseState[method](promise);
    if (expected) {
      expect(result).toBeTrue();
    } else {
      expect(result).toBeFalse();
    }
  });
});
