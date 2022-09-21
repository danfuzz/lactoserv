// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventTracker, ManualPromise } from '@this/async';
import { PromiseState } from '@this/metacomp';

import * as timers from 'node:timers/promises';


const payload1 = { type: '1:wacky:1' };
const payload2 = { type: '2:zany:2' };
const payload3 = { type: '3:fantastic:3' };
const payload4 = { type: '4:stupendous:4' };

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

    mp.resolve('nopey-nope');
    await expect(tracker.headPromise).rejects.toThrow();
  });

  test('propagates rejection into `headPromise` given a promise that rejects', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);
    const reason  = new Error('oy oy oy!');

    mp.reject(reason);
    await expect(tracker.headPromise).rejects.toThrow(reason);
  });
});

describe('constructor(<invalid>)', () => {
  test.each([
    [false],
    [[]],
    [''],
    ['bogus'],
    [['a']],
    [{}],
    [{ a: 10 }],
    [new Map()]
  ])('fails for %p', (value) => {
    expect(() => new EventTracker(value)).toThrow();
  });
});

describe('.headPromise', () => {
  test('follows along an already-resolved chain as it is `advance()`d', async () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(await tracker.headPromise).toBe(event1);
    tracker.advance(1);
    expect(await tracker.headPromise).toBe(event2);
    tracker.advance(1);
    expect(await tracker.headPromise).toBe(event3);
  });

  test('resolves promptly after the `advance()`d result\'s `next` resolves', async () => {
    const event1  = new ChainedEvent(payload1);
    const tracker = new EventTracker(event1);

    expect(await tracker.headPromise).toBe(event1);
    tracker.advance(1);

    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(tracker.headPromise)).toBeFalse();

    event1.emitter(payload2);
    const event2 = event1.nextNow;
    await timers.setImmediate();
    expect(PromiseState.isSettled(tracker.headPromise)).toBeTrue();

    expect(await tracker.headPromise).toBe(event2);
  });

  test('remains unresolved after `advance()`ing past the end of the chain', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(await tracker.headPromise).toBe(event);
    tracker.advance(1);

    await timers.setImmediate();
    expect(PromiseState.isSettled(tracker.headPromise)).toBeFalse();
  });

  test('is a rejected promise after the instance is broken (rejected event promise)', async () => {
    const error   = new Error('Oh the humanity!');
    const tracker = new EventTracker(Promise.reject(error));

    await expect(tracker.advance(0)).rejects.toThrow(error);
    await expect(tracker.headPromise).rejects.toThrow(error);
  });

  test('is a rejected promise after the instance is broken (event promise resolves to non-event)', async () => {
    const tracker = new EventTracker(Promise.resolve('oops! not an event!'));

    await expect(tracker.advance(0)).rejects.toThrow();
    await expect(tracker.headPromise).rejects.toThrow();
  });
});

describe('.headNow', () => {
  test('becomes non-`null` promptly after `headPromise` resolves (just after construction)', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);
    const event   = new ChainedEvent(payload1);

    expect(tracker.headNow).toBeNull();
    mp.resolve(event);

    await timers.setImmediate();
    expect(PromiseState.isSettled(tracker.headPromise)).toBeTrue();
    expect(await tracker.headPromise).toBe(event);
  });

  test('becomes non-`null` promptly after `advance()` async-returns (when no other `advance()` is pending)', async () => {
    const event1  = new ChainedEvent(payload1);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const advancePromise = tracker.advance(1);
    expect(tracker.headNow).toBeNull();

    event1.emitter(payload2);
    const event2 = event1.nextNow;

    await advancePromise;
    expect(tracker.headNow).toBe(event2);
  });

  test('synchronously follows along an already-resolved chain as it is `advance()`d', () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    tracker.advance(1);
    expect(tracker.headNow).toBe(event2);
    tracker.advance(1);
    expect(tracker.headNow).toBe(event3);
  });

  test('becomes `null` after `advance()`ing past the end of the chain', () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(tracker.headNow).toBe(event);
    tracker.advance(1);
    expect(tracker.headNow).toBeNull();
  });
});

describe.each`
  args      | label
  ${[null]} | ${'null'}
  ${[]}     | ${'<no-args>'}
`('advance($label)', ({ args }) => {
  test('behaves like `advance(0)`', () => {
    const event1  = new ChainedEvent(payload1);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    tracker.advance(...args);
    expect(tracker.headNow).toBe(event1);
    tracker.advance(...args);
    expect(tracker.headNow).toBe(event1);
    tracker.advance(...args);
    expect(tracker.headNow).toBe(event1);
  });
});

describe('advance(type)', () => {
  test('finds a matching `headNow`', async () => {
    const type    = 'florp';
    const event   = new ChainedEvent({ type });
    const tracker = new EventTracker(event);

    const result = tracker.advance(type);

    // Synchronous result state.
    expect(tracker.headNow).toBe(event);

    // Asynchronous call result.
    expect(await result).toBe(event);
  });

  test('finds a matching synchronous non-head', async () => {
    const type    = 'florp-like';
    const event3  = new ChainedEvent({ type });
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    const result = tracker.advance(type);

    // Synchronous result state.
    expect(tracker.headNow).toBe(event3);

    // Asynchronous call result.
    expect(await result).toBe(event3);
  });

  test('finds a matching `headPromise`', async () => {
    const type    = 'floop';
    const event   = new ChainedEvent({ type });
    const tracker = new EventTracker(Promise.resolve(event));

    const result = tracker.advance(type);

    // Synchronous result state.
    expect(tracker.headNow).toBeNull();

    // Asynchronous call result.
    expect(await result).toBe(event);

    // Synchronous post-result-resolution state.
    expect(tracker.headNow).toBe(event);
  });

  test('finds a matching asynchronous non-head', async () => {
    const type    = 'floop-like';
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    const result = tracker.advance(type);
    expect(tracker.headNow).toBeNull();

    const event1 = new ChainedEvent(payload1);
    mp.resolve(event1);
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeFalse();

    const emitter2 = event1.emitter(payload2);
    const event2 = event1.nextNow;
    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeFalse();

    emitter2({ type });
    const event3 = event2.nextNow;
    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    expect(await result).toBe(event3);

    // Synchronous post-result-resolution state.
    expect(tracker.headNow).toBe(event3);
  });
});

describe('advance(count)', () => {
  describe('advance(0)', () => {
    test('finds a matching `headNow`', async () => {
      const event   = new ChainedEvent(payload1);
      const tracker = new EventTracker(event);

      const result = tracker.advance(0);

      // Synchronous result state.
      expect(tracker.headNow).toBe(event);

      // Asynchronous call result.
      expect(await result).toBe(event);
    });

    test('finds a matching already-resolved `headPromise`', async () => {
      const event   = new ChainedEvent(payload1);
      const tracker = new EventTracker(Promise.resolve(event));

      const result = tracker.advance(0);

      // Synchronous result state.
      expect(tracker.headNow).toBeNull();

      // Asynchronous call result.
      expect(await result).toBe(event);

      // Synchronous post-result-resolution state.
      expect(tracker.headNow).toBe(event);
    });

    test('finds a matching initially-unresolved `headPromise`', async () => {
      const event   = new ChainedEvent(payload1);
      const mp      = new ManualPromise();
      const tracker = new EventTracker(mp.promise);

      const result = tracker.advance(0);

      // Synchronous result state.
      expect(tracker.headNow).toBeNull();

      mp.resolve(event);

      // Asynchronous call result.
      expect(await result).toBe(event);

      // Synchronous post-result-resolution state.
      expect(tracker.headNow).toBe(event);
    });
  });

  describe.each`
    startCount | advanceCount
    ${1}       | ${0}
    ${1}       | ${1}
    ${1}       | ${2}
    ${1}       | ${10}
    ${2}       | ${1}
    ${2}       | ${2}
    ${2}       | ${3}
    ${2}       | ${4}
    ${2}       | ${15}
    ${10}      | ${5}
    ${10}      | ${9}
    ${10}      | ${10}
    ${10}      | ${20}
  `('advance($advanceCount) with $startCount event(s) initially available', ({ startCount, advanceCount }) => {
    test('fully synchronous case', async () => {
      const events = [];
      let emitter  = null;
      for (let i = 0; i < startCount; i++) {
        if (emitter) {
          emitter = emitter({ at: i });
          events.push(events[events.length - 1].nextNow);
        } else {
          events[0] = new ChainedEvent({ at: i });
          emitter = events[0].emitter;
        }
      }

      const tracker = new EventTracker(events[0]);
      const result  = tracker.advance(advanceCount);

      if (advanceCount < startCount) {
        expect(tracker.headNow).toBe(events[advanceCount]);
        expect(await result).toBe(events[advanceCount]);
      } else {
        expect(tracker.headNow).toBeNull();
        await timers.setImmediate();
        expect(PromiseState.isSettled(result)).toBeFalse();
      }
    });

    test('asynchronous pre-resolved / partially pre-resolved case', async () => {
      const events = [];
      for (let i = startCount - 1; i >= 0; i--) {
        const next = events[0] ? Promise.resolve(events[0]) : null;
        events.unshift(new ChainedEvent({ at: i }, next));
      }

      const tracker = new EventTracker(Promise.resolve(events[0]));
      const result  = tracker.advance(advanceCount);

      expect(tracker.headNow).toBeNull();

      if (advanceCount < startCount) {
        await timers.setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
        expect(await result).toBe(events[advanceCount]);
      } else {
        await timers.setImmediate();
        expect(PromiseState.isSettled(result)).toBeFalse();

        let emitter = events[startCount - 1].emitter;
        for (let i = startCount; i <= advanceCount; i++) {
          emitter = emitter({ at: i });
          events.push(events[i - 1].nextNow);
        }

        await timers.setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
        expect(await result).toBe(events[advanceCount]);
      }

      expect(tracker.headNow).toBe(events[advanceCount]);
    });

    if (advanceCount > startCount) {
      test('asynchronous incremental resolution case', async () => {
        const events = [];
        for (let i = startCount - 1; i >= 0; i--) {
          const next = events[0] ? Promise.resolve(events[0]) : null;
          events.unshift(new ChainedEvent({ at: i }, next));
        }

        const tracker = new EventTracker(Promise.resolve(events[0]));
        const result  = tracker.advance(advanceCount);

        let emitter = events[startCount - 1].emitter;
        for (let i = startCount; i <= advanceCount; i++) {
          expect(tracker.headNow).toBeNull();
          await timers.setImmediate();
          expect(PromiseState.isSettled(result)).toBeFalse();
          emitter = emitter({ at: i });
          events.push(events[i - 1].nextNow);
        }

        await timers.setImmediate();
        expect(PromiseState.isSettled(result)).toBeTrue();
        expect(tracker.headNow).toBe(events[advanceCount]);
        expect(await result).toBe(events[advanceCount]);
      });
    }
  });
});

describe('advance(function)', () => {
  test('finds a matching `headNow`', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    const result = tracker.advance(e => e.payload === payload1);

    // Synchronous result state.
    expect(tracker.headNow).toBe(event);

    // Asynchronous call result.
    expect(await result).toBe(event);
  });

  test('finds a matching already-resolved `headPromise`', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(Promise.resolve(event));

    const result = tracker.advance(e => e.payload === payload1);

    // Synchronous result state.
    expect(tracker.headNow).toBeNull();

    // Asynchronous call result.
    expect(await result).toBe(event);

    // Synchronous post-result-resolution state.
    expect(tracker.headNow).toBe(event);
  });

  test('finds a matching initially-unresolved `headPromise`', async () => {
    const event   = new ChainedEvent(payload1);
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    const result = tracker.advance(e => e.payload === payload1);

    // Synchronous result state.
    expect(tracker.headNow).toBeNull();

    mp.resolve(event);

    // Asynchronous call result.
    expect(await result).toBe(event);

    // Synchronous post-result-resolution state.
    expect(tracker.headNow).toBe(event);
  });

  test('finds a matching event at the end of an already-resolved chain', async () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    const result = tracker.advance(e => e.payload === payload3);

    // Synchronous result state.
    expect(tracker.headNow).toBe(event3);

    // Asynchronous call result.
    expect(await result).toBe(event3);

    // Synchronous post-result-resolution state.
    expect(tracker.headNow).toBe(event3);
  });

  test('finds a matching event at the end of an eventually-resolved chain', async () => {
    const event3  = new ChainedEvent(payload3);
    const mp3     = new ManualPromise();
    const event2  = new ChainedEvent(payload2, mp3.promise);
    const mp2     = new ManualPromise();
    const event1  = new ChainedEvent(payload1, mp2.promise);
    const mp1     = new ManualPromise();
    const tracker = new EventTracker(mp1.promise);

    const result = tracker.advance(e => e.payload === payload3);

    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeFalse();
    mp1.resolve(event1);

    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeFalse();
    mp2.resolve(event2);

    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeFalse();
    mp3.resolve(event3);

    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(PromiseState.isSettled(result)).toBeTrue();
    expect(await result).toBe(event3);

    // Synchronous post-result-resolution state.
    expect(tracker.headNow).toBe(event3);
  });

  test('only calls the predicate once per event checked', async () => {
    const event3  = new ChainedEvent(payload3);
    const mp3     = new ManualPromise();
    const event2  = new ChainedEvent(payload2, mp3.promise);
    const mp2     = new ManualPromise();
    const event1  = new ChainedEvent(payload1, mp2.promise);
    const mp1     = new ManualPromise();
    const tracker = new EventTracker(mp1.promise);

    let callCount = 0;
    const result = tracker.advance((e) => {
      callCount++;
      return e.payload === payload3;
    });

    await timers.setImmediate();
    expect(callCount).toBe(0);
    mp1.resolve(event1);

    await timers.setImmediate();
    expect(callCount).toBe(1);
    mp2.resolve(event2);

    await timers.setImmediate();
    expect(callCount).toBe(2);
    mp3.resolve(event3);

    await timers.setImmediate();
    expect(callCount).toBe(3);
    expect(await result).toBe(event3);
  });
});

describe('advance(<invalid>)', () => {
  test.each([
    [false],
    [[]],
    [['a']],
    [{}],
    [{ a: 10 }],
    [class Floop {}], // This is a function, but not a _callable_ function.
    [new Map()]
  ])('fails for %p but does not break instance', async (value) => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(tracker.headNow).toBe(event);
    const result = tracker.advance(value);
    expect(tracker.headNow).toBe(event);
    await expect(result).rejects.toThrow();
    expect(() => tracker.headNow).not.toThrow();
    expect(tracker.headNow).toBe(event);
  });
});

describe('advance() breakage scenarios', () => {
  describe('on a broken instance', () => {
    test('throws', async () => {
      const tracker = new EventTracker(Promise.resolve('not-an-event-1'));

      expect(tracker.headNow).toBeNull(); // Not yet broken!
      await timers.setImmediate();
      await expect(() => tracker.advance(1)).rejects.toThrow();
    });

    test('remains broken', async () => {
      const tracker = new EventTracker(Promise.resolve('not-an-event-2'));

      await timers.setImmediate();
      await expect(() => tracker.advance()).rejects.toThrow();
      await expect(() => tracker.advance(1)).rejects.toThrow();
      await expect(() => tracker.advance('eep')).rejects.toThrow();
    });
  });

  test('causes breakage when it advances to a synchronously-known non-event', async () => {
    const event2  = new ChainedEvent(payload2);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    // We have to mess with `event1`, as it shouldn't be possible to get this
    // kind of bad behavior any other way.
    Object.defineProperty(event1, 'nextNow', {
      value:    'not-an-event',
      writable: false
    });

    // Baseline expectations.
    expect(await tracker.advance()).toBe(event1);
    expect(tracker.headNow).toBe(event1);

    // The actual test.
    const result = tracker.advance(1);
    await expect(result).rejects.toThrow();
    expect(() => tracker.headNow).toThrow();
  });

  test('causes breakage when it advances to a rejected promise', async () => {
    const mp      = new ManualPromise();
    const event1  = new ChainedEvent(payload1, mp.promise);
    const tracker = new EventTracker(event1);

    // Baseline expectations.
    expect(await tracker.advance()).toBe(event1);
    expect(tracker.headNow).toBe(event1);

    // The actual test.
    const result = tracker.advance(2);
    mp.reject(new Error('Oh noes! Golly gee!'));
    await expect(result).rejects.toThrow();
    expect(() => tracker.headNow).toThrow();
  });

  test('causes breakage when it advances to a promise that resolves to a non-event', async () => {
    const mp      = new ManualPromise();
    const event1  = new ChainedEvent(payload1, mp.promise);
    const tracker = new EventTracker(event1);

    // Baseline expectations.
    expect(await tracker.advance()).toBe(event1);
    expect(tracker.headNow).toBe(event1);

    // The actual test.
    const result = tracker.advance(2);
    mp.resolve('not-an-event-whoopsie!');
    await expect(result).rejects.toThrow();
    expect(() => tracker.headNow).toThrow();
  });

  test('causes breakage when its predicate throws', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);
    const error   = new Error('Ouch!');
    const ouch    = () => { throw error; };

    await expect(tracker.advance(ouch)).rejects.toThrow(error);
    expect(() => tracker.headNow).toThrow(error);
  });
});

describe('advanceSync()', () => {
  test('finds a synchronously-found event at `headNow`', () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(tracker.advanceSync(0)).toBe(event);
    expect(tracker.headNow).toBe(event);
  });

  test('finds a synchronously-found event in the chain', () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.advanceSync(2)).toBe(event3);
    expect(tracker.headNow).toBe(event3);
  });

  test('returns `null` when `headNow === null` (synchronously at end of chain)', () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);

    expect(tracker.headNow).toBeNull();
    expect(tracker.advanceSync(0)).toBeNull();
    expect(tracker.headNow).toBeNull();
  });

  test('returns `null` when `headNow === null` (queued `advance()`)', () => {
    const mp      = new ManualPromise();
    const event1  = new ChainedEvent(payload1, mp.promise);
    const tracker = new EventTracker(event1);

    tracker.advance(1);

    expect(tracker.headNow).toBeNull();
    expect(tracker.advanceSync(1)).toBeNull();
    expect(tracker.headNow).toBeNull();
  });

  test('causes asynchronous action even when not synchronously successful', async () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(Promise.resolve(event1));

    expect(tracker.advanceSync(2)).toBeNull();
    expect(tracker.headNow).toBeNull();
    await timers.setImmediate();
    expect(tracker.headNow).toBe(event3);
  });

  test('causes asynchronous action when "behind" another `advance()`', async () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(Promise.resolve(event1));

    const result1 = tracker.advance(1);
    expect(tracker.advanceSync(1)).toBeNull();
    await timers.setImmediate();
    expect(tracker.headNow).toBe(event3);
    expect(await result1).toBe(event2);
  });

  test('causes breakage when it is what walks the event chain into a problem', async () => {
    const mp      = new ManualPromise();
    const event1  = new ChainedEvent(payload1, mp.promise);
    const tracker = new EventTracker(event1);

    // Baseline expectations.
    expect(tracker.advanceSync(0)).toBe(event1);
    expect(tracker.headNow).toBe(event1);

    // The actual test.
    expect(tracker.advanceSync(1)).toBe(null);
    expect(tracker.headNow).toBe(null);
    mp.reject(new Error('Oh noes!'));
    await timers.setImmediate();
    expect(() => tracker.headNow).toThrow();
  });
});

describe('advanceSync(<invalid>)', () => {
  test.each([
    [false],
    [[]],
    [['a']],
    [{}],
    [{ a: 10 }],
    [class Floop {}], // This is a function, but not a _callable_ function.
    [new Map()]
  ])('fails for %p but does not break instance', async (value) => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(tracker.headNow).toBe(event);
    expect(() => tracker.advanceSync(value)).toThrow();
    expect(() => tracker.headNow).not.toThrow();
  });
});

describe('advanceSync() on a broken instance', () => {
  test('returns `null`', async () => {
    const tracker = new EventTracker(Promise.resolve('not-an-event-3'));

    expect(tracker.headNow).toBeNull(); // Not yet broken!
    await timers.setImmediate();
    expect(() => tracker.headNow).toThrow(); // Now broken!
    expect(tracker.advanceSync()).toBeNull();
  });

  test('keeps returning `null`', async () => {
    const tracker = new EventTracker(Promise.resolve('not-an-event-4'));

    expect(tracker.headNow).toBeNull(); // Not yet broken!
    await timers.setImmediate();
    expect(() => tracker.headNow).toThrow(); // Now broken!
    expect(tracker.advanceSync()).toBeNull();
    expect(tracker.advanceSync(1)).toBeNull();
    expect(tracker.advanceSync('eep')).toBeNull();
  });
});


//
// The core implementation of the class is covered by the above tests. The rest
// are intended to provide reasonable coverage assuming the above is sufficient
// for the core.
//

describe.each`
  args      | label
  ${[0]}    | ${'0'}
  ${[null]} | ${'null'}
  ${[]}     | ${'<no-args>'}
`('next($label)', ({ args }) => {
  test('walks the chain one event at a time', async () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const result1 = tracker.next(...args);
    expect(tracker.headNow).toBe(event2);
    const result2 = tracker.next(...args);
    expect(tracker.headNow).toBe(event3);
    const result3 = tracker.next(...args);
    expect(tracker.headNow).toBeNull();
    const result4 = tracker.next(...args);

    expect(await result1).toBe(event1);
    expect(await result2).toBe(event2);

    // If this expectation fails, it's because the implementation of `next()` is
    // waiting for the event after this one to get settled (which is 100% for
    // sure incorrect behavior).
    expect(PromiseState.isSettled(result3)).toBeTrue();

    expect(await result3).toBe(event3);

    expect(PromiseState.isSettled(result4)).toBeFalse();

    event3.emitter(payload4);
    const event4 = event3.nextNow;

    await timers.setImmediate();
    expect(PromiseState.isSettled(result4)).toBeTrue();

    expect(await result4).toBe(event4);
  });
});

describe('next(predicate)', () => {
  test('finds and advances just past a matching event', async () => {
    const toFind  = { findMe: 'yes!' };
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(toFind, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const result1 = tracker.next(e => e.payload === toFind);
    expect(tracker.headNow).toBe(event3);
    const result2 = tracker.next(e => e.payload === toFind);
    expect(tracker.headNow).toBeNull();
    const result3 = tracker.next();

    expect(await result1).toBe(event2);
    expect(PromiseState.isSettled(result2)).toBeFalse();

    const emitter5 = event3.emitter(toFind);
    const event4   = event3.nextNow;

    await timers.setImmediate();

    // If this expectation fails, it's because the implementation of `next()` is
    // waiting for the event after this one to get settled (which is 100% for
    // sure incorrect behavior).
    expect(PromiseState.isSettled(result2)).toBeTrue();
    expect(PromiseState.isSettled(result3)).toBeFalse();
    expect(await result2).toBe(event4);
    expect(PromiseState.isSettled(result3)).toBeFalse();

    emitter5(payload2);
    const event5 = event4.nextNow;

    await timers.setImmediate();
    expect(PromiseState.isSettled(result3)).toBeTrue();
    expect(await result3).toBe(event5);
  });

  test('does not find an event which was to be skipped over', async () => {
    const toFind  = { yes: 'really!' };
    const event2  = new ChainedEvent(toFind);
    const event1  = new ChainedEvent(toFind, event2);
    const tracker = new EventTracker(Promise.resolve(event1));

    const result1 = tracker.next();
    const result2 = tracker.next(e => e.payload === toFind);

    expect(await result1).toBe(event1);

    await timers.setImmediate();
    expect(PromiseState.isSettled(result2)).toBeTrue();
    expect(await result2).toBe(event2);
  });
});

describe('next(<invalid>)', () => {
  test('throws but does not break instance or advance the head', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    await expect(tracker.next(['not-a-predicate'])).rejects.toThrow();
    expect(tracker.headNow).toBe(event);
  });
});

describe('next() breakage scenarios', () => {
  test('throws when the instance was broken before the call', async () => {
    const tracker = new EventTracker(Promise.resolve('oops-not-an-event'));

    // Cause instance to break.
    await expect(tracker.advance()).rejects.toThrow();

    // Actual test.
    await expect(tracker.next()).rejects.toThrow();
  });

  test('throws when the instance becomes broken during the event search', async () => {
    const event2  = Promise.resolve('oops-not-an-event');
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    await expect(tracker.next(1)).rejects.toThrow();

    // Confirm breakage (and not just that the method threw).
    expect(() => tracker.headNow).toThrow();
  });
});

describe('peek()', () => {
  test.each`
    args      | label
    ${[0]}    | ${'0'}
    ${[null]} | ${'null'}
    ${[]}     | ${'<no-args>'}
  `('peek($label) is equivalent to `.headPromise`', async ({ args }) => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(await tracker.peek(...args)).toBe(event);

    // Confirm that the head hasn't been advanced.
    expect(tracker.headNow).toBe(event);
  });

  test('finds a matching event without advancing to or past it', async () => {
    const toFind  = { findMe: 'yes!' };
    const event3  = new ChainedEvent(toFind);
    const event2  = new ChainedEvent(toFind, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const result1 = tracker.peek(e => e.payload === toFind);
    expect(tracker.headNow).toBe(event1);
    const result2 = tracker.peek(e => e.payload === toFind);
    expect(tracker.headNow).toBe(event1);

    expect(await result1).toBe(event2);
    expect(await result2).toBe(event2);
  });

  test('throws but does not break instance when encountering a problematic event', async () => {
    const event1  = new ChainedEvent(payload1, Promise.reject(new Error('eek!')));
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const result = tracker.peek(5);
    expect(tracker.headNow).toBe(event1);

    await expect(result).rejects.toThrow();
    expect(tracker.headNow).toBe(event1);
  });

  test('throws but does not break instance when given an invalid predicate', async () => {
    const event1  = new ChainedEvent(payload1);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const result = tracker.peek(['nope-not-a-predicate']);
    expect(tracker.headNow).toBe(event1);

    await expect(result).rejects.toThrow();
    expect(tracker.headNow).toBe(event1);
  });

  test('throws but does not break instance when its predicate throws', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);
    const error   = new Error('Ouch!');
    const ouch    = () => { throw error; };

    await expect(tracker.peek(ouch)).rejects.toThrow(error);
    expect(tracker.headNow).toBe(event);
  });

  test('throws when called on an already-broken instance', async () => {
    const tracker = new EventTracker(Promise.resolve('oops-not-an-event'));

    // Cause instance to break.
    await expect(tracker.advance()).rejects.toThrow();

    // Actual test.
    await expect(tracker.peek()).rejects.toThrow();
  });
});
