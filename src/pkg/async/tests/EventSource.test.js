// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { EventSource, LinkedEvent, PromiseState } from '@this/async';


// For testing subclass scenarios.
class ZanyEvent extends LinkedEvent {
  // This space intentionally left blank.
}

const payload1 = { type: 'wacky' };
const payload2 = { type: 'zany' };
const payload3 = { type: 'questionable' };

describe.each`
  label                             | argFn                                           | cls             | keepCount
  ${''}                             | ${() => []}                                     | ${LinkedEvent} | ${0}
  ${'null'}                         | ${() => [null]}                                 | ${LinkedEvent} | ${0}
  ${'undefined'}                    | ${() => [undefined]}                            | ${LinkedEvent} | ${0}
  ${'{ keepCount: 0 }'}             | ${() => [{ keepCount: 0 }]}                     | ${LinkedEvent} | ${0}
  ${'{ keepCount: 1 }'}             | ${() => [{ keepCount: 1 }]}                     | ${LinkedEvent} | ${1}
  ${'{ keepCount: 10 }'}            | ${() => [{ keepCount: 10 }]}                    | ${LinkedEvent} | ${10}
  ${'{ keepCount: +inf }'}          | ${() => [{ keepCount: Infinity }]}              | ${LinkedEvent} | ${Infinity}
  ${'{ kickoffEvent: null }'}       | ${() => [{ kickoffEvent: null }]}               | ${LinkedEvent} | ${0}
  ${'{ kickoffEvent: <subclass> }'} | ${() => [{ kickoffEvent: new ZanyEvent('x') }]} | ${ZanyEvent}    | ${0}
`('constructor($label)', ({ argFn, cls, keepCount }) => {
  test('trivially succeeds', () => {
    expect(() => new EventSource(...argFn())).not.toThrow();
  });

  test('produces an instance whose `currentEvent` is unsettled', async () => {
    const source = new EventSource(...argFn());

    await timers.setImmediate();
    expect(PromiseState.isSettled(source.currentEvent)).toBeFalse();
  });

  test('produces an instance whose `currentEventNow` is `null`', async () => {
    const source = new EventSource(...argFn());
    expect(source.currentEventNow).toBeNull();
  });

  test('produces an instance whose `earliestEvent` is unsettled', async () => {
    const source = new EventSource(...argFn());

    await timers.setImmediate();
    expect(PromiseState.isSettled(source.earliestEvent)).toBeFalse();
  });

  test('produces an instance whose `earliestEventNow` is `null`', async () => {
    const source = new EventSource(...argFn());
    expect(source.earliestEventNow).toBeNull();
  });

  test('produces an instance whose `keepCount` is as expected', async () => {
    const source = new EventSource(...argFn());
    expect(source.keepCount).toBe(keepCount);
  });

  test('produces an instance which emits instances of the appropriate class', () => {
    const source = new EventSource(...argFn());
    const event  = source.emit(payload1);
    expect(event).toBeInstanceOf(cls);
  });
});

describe('.currentEvent', () => {
  test('is a promise', async () => {
    const source = new EventSource();

    expect(source.currentEvent).toBeInstanceOf(Promise);
    source.emit(payload1);
    expect(source.currentEvent).toBeInstanceOf(Promise);
  });

  test('tracks the events that have been emitted', async () => {
    const source = new EventSource();

    source.emit(payload1);
    expect((await source.currentEvent).payload).toBe(payload1);
    source.emit(payload2);
    expect((await source.currentEvent).payload).toBe(payload2);
    source.emit(payload3);
    expect((await source.currentEvent).payload).toBe(payload3);
  });
});

describe('.currentEventNow', () => {
  test('tracks the events that have been emitted', async () => {
    const source = new EventSource();

    source.emit(payload1);
    expect(source.currentEventNow.payload).toBe(payload1);
    source.emit(payload2);
    expect(source.currentEventNow.payload).toBe(payload2);
    source.emit(payload3);
    expect(source.currentEventNow.payload).toBe(payload3);
  });
});

describe.each`
  prop                  | isAsync
  ${'earliestEvent'}    | ${true}
  ${'earliestEventNow'} | ${false}
`('.$prop', ({ prop, isAsync }) => {
  test.each`
    keepCount | testCounts
    ${0}         | ${[0, 1, 5]}
    ${1}         | ${[0, 1, 2, 5]}
    ${2}         | ${[1, 2, 3, 12]}
    ${10}        | ${[9, 10, 11]}
    ${100}       | ${[90, 99, 100, 101, 200]}
    ${+Infinity} | ${[0, 10, 100, 200, 500]}
  `('`keepCount === $keepCount`; test counts: $testCounts', async ({ keepCount, testCounts }) => {
    const source    = new EventSource({ keepCount });
    const events    = [];
    const lastCount = testCounts[testCounts.length - 1];

    let lastCheck = -1;
    const checkCount = async (emittedCount, got) => {
      if (lastCheck === emittedCount) {
        // Don't bother re-checking something we just checked.
        return;
      }
      lastCheck = emittedCount;

      if (emittedCount === 0) {
        // Special cases for the first event.
        if (isAsync) {
          expect(PromiseState.isPending(got)).toBeTrue();
        } else {
          expect(got).toBeNull();
        }
        return;
      }

      if (isAsync) {
        expect(PromiseState.isFulfilled(got)).toBeTrue();
      } else {
        expect(got).not.toBeNull();
      }

      // Which event (by index into `events`) should be the `earliest`.
      const expectIndex = Math.max(0, emittedCount - keepCount - 1);
      got = isAsync ? (await got) : got;
      expect(got.payload).toBe(events[expectIndex].payload);
      expect(got).toBe(events[expectIndex]);

      // How long to expect the chain to be between `earliest` and `current`.
      const expectedKeptCount = Math.min(keepCount, emittedCount - 1);
      let count = 0;
      for (let at = got; at !== source.currentEventNow; at = at.nextNow) {
        count++;
      }
      expect(count).toBe(expectedKeptCount);
    };

    for (let i = 0; i <= lastCount; i++) {
      const doTest = (i === testCounts[0]);
      if (doTest) {
        testCounts.shift();
        await checkCount(i, source[prop]);
      }
      events.push(source.emit({ count: i }));
      if (doTest) {
        await checkCount(i + 1, source[prop]);
      }
    }
  });
});

describe('.keepCount', () => {
  // This is actually pretty well covered in the constructor tests.
  test('is the value passed in the constructor', () => {
    const source = new EventSource({ keepCount: 123 });
    expect(source.keepCount).toBe(123);
  });
});

describe('emit()', () => {
  test('appends an event with the expected payload', () => {
    const source = new EventSource();
    expect(source.emit(payload1).payload).toBe(payload1);
  });

  test('returns an instance which becomes `.currentEventNow`', () => {
    const source = new EventSource();
    const result = source.emit(payload1);
    expect(source.currentEventNow).toBe(result);
  });

  test('returns an instance whose `.emitter` is spoken for', () => {
    const source = new EventSource();
    const result = source.emit(payload1);
    expect(() => result.emitter).toThrow();
  });
});
