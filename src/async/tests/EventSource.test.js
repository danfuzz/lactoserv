// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { EventPayload, EventSource, LinkedEvent, PromiseState } from '@this/async';


// For testing subclass scenarios.
class ZanyEvent extends LinkedEvent {
  // This space intentionally left blank.
}

// For testing subclass scenarios.
class ZanyPayload extends EventPayload {
  // This space intentionally left blank.
}


const payload1 = new EventPayload('wacky');
const payload2 = new EventPayload('zany');
const payload3 = new EventPayload('questionable');

describe.each`
  label                               | argFn                                                | eventClass     | payloadClass    | keepCount
  ${''}                               | ${() => []}                                          | ${LinkedEvent} | ${EventPayload} | ${0}
  ${'null'}                           | ${() => [null]}                                      | ${LinkedEvent} | ${EventPayload} | ${0}
  ${'undefined'}                      | ${() => [undefined]}                                 | ${LinkedEvent} | ${EventPayload} | ${0}
  ${'{ keepCount: 0 }'}               | ${() => [{ keepCount: 0 }]}                          | ${LinkedEvent} | ${EventPayload} | ${0}
  ${'{ keepCount: 1 }'}               | ${() => [{ keepCount: 1 }]}                          | ${LinkedEvent} | ${EventPayload} | ${1}
  ${'{ keepCount: 10 }'}              | ${() => [{ keepCount: 10 }]}                         | ${LinkedEvent} | ${EventPayload} | ${10}
  ${'{ keepCount: +inf }'}            | ${() => [{ keepCount: Infinity }]}                   | ${LinkedEvent} | ${EventPayload} | ${Infinity}
  ${'{ kickoffPayload: null }'}       | ${() => [{ kickoffPayload: null }]}                  | ${LinkedEvent} | ${EventPayload} | ${0}
  ${'{ kickoffPayload: <subclass> }'} | ${() => [{ kickoffPayload: new ZanyPayload('x') }]}  | ${LinkedEvent} | ${ZanyPayload}  | ${0}
  ${'{ kickoffEvent: null }'}         | ${() => [{ kickoffEvent: null }]}                    | ${LinkedEvent} | ${EventPayload} | ${0}
  ${'{ kickoffEvent: <subclass> }'}   | ${() => [{ kickoffEvent: new ZanyEvent(payload1) }]} | ${ZanyEvent}   | ${EventPayload} | ${0}
`('constructor($label)', ({ argFn, eventClass, payloadClass, keepCount }) => {
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
    const event  = source.emit(new payloadClass('florp'));
    expect(event).toBeInstanceOf(eventClass);
  });

  test('produces an instance which refuses to emit payloads of the wrong class', () => {
    const source = new EventSource(...argFn());
    if (payloadClass === EventPayload) {
      expect(() => source.emit({ x: 10 })).toThrow();
    } else {
      expect(() => source.emit(new EventPayload('beep', 20))).toThrow();
    }
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
      events.push(source.emit(new EventPayload('count', i)));
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

  test('refuses to emit a payload that doesn\'t match the kickoff payload', () => {
    const source = new EventSource({ kickoffPayload: new ZanyPayload('beep') });
    expect(() => source.emit(new EventPayload('boop'))).toThrow();
    expect(() => source.emit(new ZanyPayload('boop'))).not.toThrow();
  });

  test.each`
  value
  ${{}}
  ${{ type: 'beep', args: [1, 2, 3] }}
  ${[]}
  ${['beep', 'boop']}
  ${new Map()}
  `('refuses to emit non-`EventPayload` object $value', (value) => {
    const source = new EventSource();
    expect(() => source.emit(value)).toThrow();
  });

  test.each`
  value
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${'beep'}
  ${Symbol('boop')}
  `('refuses to emit non-object $value', (value) => {
    const source = new EventSource();
    expect(() => source.emit(value)).toThrow();
  });
});

describe('isLinkedFrom()', () => {
  test.each`
  value
  ${null}
  ${undefined}
  ${false}
  ${1234}
  ${'florp'}
  ${new Map()}
  `('returns `false` given a non-event $value', (value) => {
    const source = new EventSource();
    expect(source.isLinkedFrom(value)).toBeFalse();
  });

  test('returns `false` given an event that was not emitted by the instance', () => {
    const source = new EventSource();
    const event  = new LinkedEvent(payload1);
    expect(source.isLinkedFrom(event)).toBeFalse();
  });

  test('returns `true` given the most-recently emitted event', () => {
    const source = new EventSource();
    const event  = source.emit(payload1);
    expect(source.isLinkedFrom(event)).toBeTrue();
  });

  test('returns `true` given an event that directly links to the most-recently emitted event', () => {
    const source = new EventSource();
    const event1 = source.emit(payload1);

    source.emit(payload2);
    expect(source.isLinkedFrom(event1)).toBeTrue();
  });

  test('returns `true` given an event that indirectly links to the most-recently emitted event', () => {
    const source = new EventSource();
    const event1 = source.emit(payload1);

    for (let i = 0; i < 20; i++) {
      source.emit(payload2);
    }

    expect(source.isLinkedFrom(event1)).toBeTrue();
  });
});
