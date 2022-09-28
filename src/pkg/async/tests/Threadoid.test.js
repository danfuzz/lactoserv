// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { PromiseState, Threadoid } from '@this/async';

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
  // TODO
});

describe('run()', () => {
  // TODO
});

describe('shouldStop()', () => {
  // TODO
});

describe('stop()', () => {
  // TODO
});

describe('whenStopRequested()', () => {
  // TODO
});
