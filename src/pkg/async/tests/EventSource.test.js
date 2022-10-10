// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { ChainedEvent, EventSource, PromiseState } from '@this/async';


// For testing subclass scenarios.
class ZanyEvent extends ChainedEvent {
  // This space intentionally left blank.
}

const payload1 = { type: 'wacky' };
const payload2 = { type: 'zany' };
const payload3 = { type: 'questionable' };

describe.each`
  label                             | argFn                                           | cls             | keepCount
  ${''}                             | ${() => []}                                     | ${ChainedEvent} | ${0}
  ${'null'}                         | ${() => [null]}                                 | ${ChainedEvent} | ${0}
  ${'undefined'}                    | ${() => [undefined]}                            | ${ChainedEvent} | ${0}
  ${'{ keepCount: 0 }'}             | ${() => [{ keepCount: 0 }]}                     | ${ChainedEvent} | ${0}
  ${'{ keepCount: 1 }'}             | ${() => [{ keepCount: 1 }]}                     | ${ChainedEvent} | ${1}
  ${'{ keepCount: 10 }'}            | ${() => [{ keepCount: 10 }]}                    | ${ChainedEvent} | ${10}
  ${'{ keepCount: +inf }'}          | ${() => [{ keepCount: Infinity }]}              | ${ChainedEvent} | ${Infinity}
  ${'{ kickoffEvent: null }'}       | ${() => [{ kickoffEvent: null }]}               | ${ChainedEvent} | ${0}
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
