// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventSource } from '@this/async';

import * as timers from 'node:timers/promises';


const payload1 = { type: 'wacky' };
const payload2 = { type: 'zany' };
const payload3 = { type: 'questionable' };

describe('constructor()', () => {
  test('trivially succeeds', () => {
    expect(() => new EventSource()).not.toThrow();
  });

  test('produces an instance whose `currentEvent` is unsettled', async () => {
    const source = new EventSource();

    const race = await Promise.race([source.currentEvent, timers.setImmediate(123)]);
    expect(race).toBe(123);
  });

  test('produces an instance whose `currentEventNow` is `null`', async () => {
    const source = new EventSource();
    expect(source.currentEventNow).toBeNull();
  });
});

describe('.currentEvent', () => {
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
