// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventTracker, ManualPromise } from '@this/async';

import * as timers from 'node:timers/promises';


const payload1 = { type: 'wacky' };
const payload2 = { type: 'zany' };
const payload3 = { type: 'questionable' };

describe('constructor(ChainedEvent)', () => {
  test('trivially succeeds', () => {
    expect(() => new EventTracker(new ChainedEvent('woop'))).not.toThrow();
  });
});

describe('constructor(Promise)', () => {
  test('trivially succeeds given a promise that never resolves', () => {
    const mp = new ManualPromise();
    expect(() => new EventTracker(mp.promise)).not.toThrow();
  });

  test('succeeds given a promise that resolves to a valid value', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    mp.resolve(new ChainedEvent(payload1));
    await tracker.first;
  });

  test('causes rejection of `first` given a promise that resolves to something invalid', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    mp.resolve('nopers');
    expect(tracker.first).rejects.toThrow();
  });

  test('propagates rejection into `first` given a promise that rejects', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);
    const reason  = new Error('oy!');

    mp.reject(reason);
    expect(tracker.first).rejects.toBe(reason);
  });
});

describe('constructor(<invalid>)', () => {
  test.each([
    [false],
    [[]],
    [''],
    ['nopers'],
    [['a']],
    [{}],
    [{ a: 10 }],
    [new Map()]
  ])('fails for %p', (value) => {
    expect(() => new EventTracker(value)).toThrow();
  });
});

describe('.first', () => {
  // TODO
});

describe('.firstNow', () => {
  // TODO
});

describe('advance()', () => {
  // TODO
});
