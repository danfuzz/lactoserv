// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventTracker, ManualPromise } from '@this/async';

import * as timers from 'node:timers/promises';


const payload1 = { type: '1:wacky:1' };
const payload2 = { type: '2:zany:2' };
const payload3 = { type: '3:questionable:3' };

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
  test('follows along an already-resolved chain as it is `advance()`d.', async () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(await tracker.headPromise).toBe(event1);
    tracker.advance();
    expect(await tracker.headPromise).toBe(event2);
    tracker.advance();
    expect(await tracker.headPromise).toBe(event3);
  });

  test('resolves promptly after the `advance()`d result\'s `next` resolves', async () => {
    const event1  = new ChainedEvent(payload1);
    const tracker = new EventTracker(event1);

    expect(await tracker.headPromise).toBe(event1);
    tracker.advance();

    expect(tracker.headNow).toBeNull();

    const race1 = Promise.race([tracker.headPromise, timers.setTimeout(10, 123)]);
    expect(await race1).toBe(123);

    event1.emitter(payload2);
    const event2 = event1.nextNow;
    const race2 = Promise.race([tracker.headPromise, timers.setTimeout(10, 456)]);

    expect(await race2).toBe(event2);
  });

  test('remains unresolved after `advance()`ing past the end of the chain.', async () => {
    const event   = new ChainedEvent(payload1);
    const tracker = new EventTracker(event);

    expect(await tracker.headPromise).toBe(event);
    tracker.advance();

    const race = Promise.race([tracker.headPromise, timers.setTimeout(10, 123)]);
    expect(await race).toBe(123);
  });
});

describe('.headNow', () => {
  test('becomes non-`null` promptly after `headPromise` resolves (just after construction)', async () => {
    const mp      = new ManualPromise();
    const tracker = new EventTracker(mp.promise);
    const event   = new ChainedEvent(payload1);

    expect(tracker.headNow).toBeNull();
    mp.resolve(event);

    const race = Promise.race([tracker.headPromise, timers.setTimeout(100)]);
    expect(await race).toBe(event);
  });

  test('becomes non-`null` promptly after `advance()` async-returns (when no other `advance()` is pending)', async () => {
    const event1  = new ChainedEvent(payload1);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    const advancePromise = tracker.advance();
    expect(tracker.headNow).toBeNull();

    event1.emitter(payload2);
    const event2 = event1.nextNow;

    await advancePromise;
    expect(tracker.headNow).toBe(event2);
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
  });
});

describe.each`
  args      | label
  ${[null]} | ${'null'}
  ${[]}     | ${'<no-args>'}
`('advance($label)', ({ args }) => {
  test('behaves like `advance(1)`', () => {
    const event3  = new ChainedEvent(payload3);
    const event2  = new ChainedEvent(payload2, event3);
    const event1  = new ChainedEvent(payload1, event2);
    const tracker = new EventTracker(event1);

    expect(tracker.headNow).toBe(event1);
    tracker.advance(...args);
    expect(tracker.headNow).toBe(event2);
    tracker.advance(...args);
    expect(tracker.headNow).toBe(event3);
    tracker.advance(...args);
    expect(tracker.headNow).toBeNull();
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
    const race1 = Promise.race([result, timers.setTimeout(10, 101)]);
    expect(await race1).toBe(101);

    const emitter2 = event1.emitter(payload2);
    const event2 = event1.nextNow;
    expect(tracker.headNow).toBeNull();
    const race2 = Promise.race([result, timers.setTimeout(10, 102)]);
    expect(await race2).toBe(102);

    emitter2({ type });
    const event3 = event2.nextNow;
    expect(tracker.headNow).toBeNull();
    const race3 = Promise.race([result, timers.setTimeout(10, 103)]);
    expect(await race3).toBe(event3);

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
    ${0}       | ${0}
    ${0}       | ${1}
    ${0}       | ${2}
    ${0}       | ${4}
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
    if (startCount > 0) {
      test('fully synchonous case', async () => {
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
          const race = Promise.race([result, timers.setTimeout(10, 123)]);
          expect(await race).toBe(123);
        }
      });
    }

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
        const race = Promise.race([result, timers.setTimeout(10, 101)]);
        expect(await race).toBe(events[advanceCount]);
      } else {
        const race1 = Promise.race([result, timers.setTimeout(10, 202)]);
        expect(await race1).toBe(202);

        let emitter = events[startCount - 1].emitter;
        for (let i = startCount; i <= advanceCount; i++) {
          emitter = emitter({ at: i });
          events.push(events[i - 1].nextNow);
        }

        const race2 = Promise.race([result, timers.setTimeout(10, 303)]);
        expect(await race2).toBe(events[advanceCount]);
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

        expect(tracker.headNow).toBeNull();

        let emitter = events[startCount - 1].emitter;
        for (let i = startCount; i <= advanceCount; i++) {
          const race = Promise.race([result, timers.setTimeout(10, 1000 + i)]);
          expect(await race).toBe(1000 + i);
          emitter = emitter({ at: i });
          events.push(events[i - 1].nextNow);
        }

        const race = Promise.race([result, timers.setTimeout(10, 234)]);
        expect(await race).toBe(events[advanceCount]);
        expect(tracker.headNow).toBe(events[advanceCount]);
      });
    }
  });

  // TODO
});

describe('advance(function)', () => {
  // TODO
});
