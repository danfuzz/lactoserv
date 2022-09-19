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

  test('makes an instance with the given first event as the `headNow`', () => {
    const event   = new ChainedEvent('boop');
    const tracker = new EventTracker(event);
    expect(tracker.headNow).toBe(event);
  });

  test('makes an instance with a `headPromise` that promptly resolves to the given first event', async () => {
    const event   = new ChainedEvent('boop');
    const tracker = new EventTracker(event);

    await expect(tracker.headPromise).resolves.toBe(event);
  });
});

describe('constructor(Promise)', () => {
  test('trivially succeeds given a promise that never resolves', () => {
    const mp = new ManualPromise();
    expect(() => new EventTracker(mp.promise)).not.toThrow();
  });

  test('makes an instance with `headNow === null` (at first)', () => {
    const eventProm = Promise.resolve(new ChainedEvent('boop'));
    const tracker   = new EventTracker(eventProm);
    expect(tracker.headNow).toBeNull();
  });

  test('makes an instance with a non-null `headPromise`', () => {
    const eventProm = Promise.resolve(new ChainedEvent('boop'));
    const tracker   = new EventTracker(eventProm);
    expect(tracker.headPromise).not.toBeNull();
  });

  test('succeeds given a promise that resolves to a valid value', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    mp.resolve(new ChainedEvent(payload1));
    await tracker.headPromise;
  });

  test('causes rejection of `headPromise` given a promise that resolves to something invalid', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    mp.resolve('nopers');
    await expect(tracker.headPromise).rejects.toThrow();
  });

  test('propagates rejection into `headPromise` given a promise that rejects', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);
    const reason  = new Error('oy!');

    mp.reject(reason);
    await expect(tracker.headPromise).rejects.toThrow(reason);
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

describe('.headPromise', () => {
  // TODO
});

describe('.headNow', () => {
  test('becomes non-`null` promptly after `headPromise` resolves', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);
    const event   = new ChainedEvent(payload1);

    expect(tracker.headNow).toBeNull();
    mp.resolve(event);

    const race = await Promise.race([tracker.headPromise, timers.setTimeout(100)]);
    expect(race).toBe(event);
  });

  test('synchronously follows along an already-resolved chain as it is `advance()`d.', () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    tracker.advance();
    expect(tracker.headNow).toBe(event2);
    tracker.advance();
    expect(tracker.headNow).toBe(event3);
  });

  test('becomes `null` after `advance()`ing past the end of the chain.', () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(tracker.headNow).toBe(event);
    tracker.advance();
    expect(tracker.headNow).toBeNull();
  })
});

describe('advance()', () => {
  // TODO
});
