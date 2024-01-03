// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { ManualPromise, PromiseUtil } from '@this/async';


const stateChecks = (maker, { isFulfilled, isRejected, value, reason }) => {
  if (isFulfilled || isRejected) {
    test('is settled', () => {
      const mp = maker();
      expect(mp.isSettled()).toBeTrue();
    });
  } else {
    test('is not settled', () => {
      const mp = maker();
      expect(mp.isSettled()).toBeFalse();
    });
  }

  if (isFulfilled) {
    test('is fulfilled', () => {
      const mp = maker();
      expect(mp.isFulfilled()).toBeTrue();
    });
    test('has the expected `fulfilledValue`', () => {
      const mp = maker();
      expect(mp.fulfilledValue).toBe(value);
    });
    test('has a `promise` that resolves as expected', () => {
      const mp = maker();
      expect(mp.promise).resolves.toBe(value);
    });
  } else {
    test('is not fulfilled', () => {
      const mp = maker();
      expect(mp.isFulfilled()).toBeFalse();
    });
    test('has no `fulfilledValue` (it throws)', () => {
      const mp = maker();
      expect(() => mp.fulfilledValue).toThrow();
    });
  }

  if (isRejected) {
    test('is rejected', () => {
      const mp = maker();
      expect(mp.isRejected()).toBeTrue();
    });
    test('has the expected `rejectedReason`', () => {
      const mp = maker();
      expect(mp.rejectedReason).toBe(reason);
    });
    test('has a `promise` that rejects as expected', () => {
      const mp = maker();
      expect(mp.promise).rejects.toBe(reason);
    });
  } else {
    test('is not rejected', () => {
      const mp = maker();
      expect(mp.isRejected()).toBeFalse();
    });
    test('has no `rejectedReason` (it throws)', () => {
      const mp = maker();
      expect(() => mp.rejectedReason).toThrow();
    });
  }
};

describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new ManualPromise()).not.toThrow();
  });

  describe('state checks', () => {
    const maker = () => {
      return new ManualPromise();
    };

    stateChecks(maker, { isFulfilled: false, isRejected: false });
  });
});

describe('reject()', () => {
  test.each([
    [undefined],
    [null],
    [false],
    [''],
    [0],
    [[]],
    [{}],
    [123],
    ['florp'],
    [[1, 2, 3]],
    [{ a: 123, b: 456 }],
    [new Map()],
    [new Error('This one should _definitely_ work!')]
  ])('accepts %p', async (reason) => {
    const mp = new ManualPromise();
    expect(() => mp.reject(reason)).not.toThrow();
    expect(mp.promise).rejects.toBe(reason);
    expect(mp.rejectedReason).toBe(reason);
  });

  describe('state checks', () => {
    const reason = new Error('oof');

    const maker = () => {
      const mp = new ManualPromise();
      mp.reject(reason);

      // We have to promptly handle the rejection, since otherwise Node will
      // complain.
      PromiseUtil.handleRejection(mp.promise);

      return mp;
    };

    stateChecks(maker, { isFulfilled: false, isRejected: true, reason });
  });

  describe('prevents double-settling', () => {
    test('reject -> reject', () => {
      const mp = new ManualPromise();
      expect(() => mp.reject(new Error('1'))).not.toThrow();
      mp.rejectedReason; // "We handled the rejection!"
      expect(() => mp.reject(new Error('2'))).toThrow();
    });

    test('resolve -> reject', () => {
      const mp = new ManualPromise();
      expect(() => mp.resolve('1')).not.toThrow();
      expect(() => mp.reject(new Error('2'))).toThrow();
    });
  });
});

describe('rejectAndHandle()', () => {
  test('does not cause an unhandled rejection', async () => {
    const mp = new ManualPromise();
    mp.rejectAndHandle(new Error('THIS SHOULD NOT SHOW UP AS AN UNHANDLED REJECTION!'));
  });

  // Note: Beyond the above, we assume `rejectAndHandle()` is identical to
  // plain `reject()`.
});

describe('resolve()', () => {
  test.each([
    [undefined],
    [null],
    [false],
    [''],
    [0],
    [[]],
    [{}],
    [123],
    ['florp'],
    [[1, 2, 3]],
    [{ a: 123, b: 456 }],
    [new Map()],
    [new Error('YES!')]
  ])('accepts %p', async (value) => {
    const mp = new ManualPromise();
    expect(() => mp.resolve(value)).not.toThrow();
    expect(mp.promise).resolves.toBe(value);
    expect(mp.fulfilledValue).toBe(value);
  });

  describe('state checks', () => {
    const value = { a: 'yes' };

    const maker = () => {
      const mp = new ManualPromise();
      mp.resolve(value);
      return mp;
    };

    stateChecks(maker, { isFulfilled: true, isRejected: false, value });
  });

  describe('prevents double-settling', () => {
    test('resolve -> resolve', () => {
      const mp = new ManualPromise();
      expect(() => mp.resolve('1')).not.toThrow();
      expect(() => mp.resolve('2')).toThrow();
    });

    test('reject -> resolve', () => {
      const mp = new ManualPromise();
      expect(() => mp.reject(new Error('1'))).not.toThrow();
      mp.rejectedReason; // "We handled the rejection!"
      expect(() => mp.resolve('2')).toThrow();
    });
  });
});

describe('resolve(Promise)', () => {
  test('links the resolution of a fulfilled promise', async () => {
    const mp     = new ManualPromise();
    const target = new ManualPromise();

    mp.resolve(target.promise);

    // Not fulfilled or rejected yet, because `target` isn't.
    expect(mp.isFulfilled()).toBeFalse();
    expect(mp.isRejected()).toBeFalse();
    expect(mp.isSettled()).toBeFalse();

    target.resolve('yeppers');

    // Not fulfilled or rejected yet, because `mp` needs a turn to run its
    // asynchronous resolver code.
    expect(mp.isFulfilled()).toBeFalse();
    expect(mp.isRejected()).toBeFalse();
    expect(mp.isSettled()).toBeFalse();

    await timers.setImmediate();

    // Now fulfilled!
    expect(mp.isFulfilled()).toBeTrue();
    expect(mp.isRejected()).toBeFalse();
    expect(mp.isSettled()).toBeTrue();
    expect(mp.fulfilledValue).toBe('yeppers');
  });

  test('links the resolution of a rejected promise', async () => {
    const reason = new Error('Woe!');
    const mp     = new ManualPromise();
    const target = new ManualPromise();

    mp.resolve(target.promise);

    // Not fulfilled or rejected yet, because `target` isn't.
    expect(mp.isFulfilled()).toBeFalse();
    expect(mp.isRejected()).toBeFalse();
    expect(mp.isSettled()).toBeFalse();

    target.reject(reason);

    // Make sure Node doesn't complain about an unhandled rejection.
    PromiseUtil.handleRejection(mp.promise);

    // Not fulfilled or rejected yet, because `mp` needs a turn to run its
    // asynchronous resolver code.
    expect(mp.isFulfilled()).toBeFalse();
    expect(mp.isRejected()).toBeFalse();
    expect(mp.isSettled()).toBeFalse();

    await timers.setImmediate();

    // Now rejected!
    expect(mp.isFulfilled()).toBeFalse();
    expect(mp.isRejected()).toBeTrue();
    expect(mp.isSettled()).toBeTrue();
    expect(mp.rejectedReason).toBe(reason);
  });

  test('prevents double-settling', () => {
    const mp = new ManualPromise();
    mp.resolve(new ManualPromise().promise);

    expect(() => mp.resolve(1)).toThrow();
    expect(() => mp.reject(new Error('2!'))).toThrow();
    expect(() => mp.resolve(Promise.resolve(3))).toThrow();
  });
});
