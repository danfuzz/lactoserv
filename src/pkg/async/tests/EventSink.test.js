// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventSink, PromiseState, PromiseUtil } from '@this/async';

import * as timers from 'node:timers/promises';
import { writeFileSync } from 'node:fs';
const stderr = s => writeFileSync('/dev/stderr', `${s}\r\n`);

const payload1 = { type: 'wacky' };
const payload2 = { type: 'zany' };
const payload3 = { type: 'questionable' };

describe('constructor(<invalid>, event)', () => {
  test.each([
    [null],
    [true],
    [123],
    ['not-a-function'],
    [['also', 'not', 'a', 'function']]
  ])('%p fails', (value) => {
    const event = new ChainedEvent(payload1);
    expect(() => new EventSink(value, event)).toThrow();
  });
});

describe('constructor(function, <invalid>)', () => {
  test.each([
    [null],
    [true],
    [123],
    ['not-an-event'],
    [['also', 'not', 'an', 'event']]
  ])('%p fails', (value) => {
    expect(() => new EventSink(() => true, value)).toThrow();
  });
});

describe('constructor(function, event)', () => {
  test('trivially succeeds', () => {
    const event = new ChainedEvent(payload1);
    expect(() => new EventSink(() => true, event)).not.toThrow();
  });
});

describe('constructor(function, promise)', () => {
  test('trivially succeeds, given a promise that resolves to an event', () => {
    const promise = Promise.resolve(new ChainedEvent(payload1));
    expect(() => new EventSink(() => true, promise)).not.toThrow();
  });

  test('trivially succeeds, given a promise that resolves to a non-event', () => {
    const promise = Promise.resolve('not-an-event');
    expect(() => new EventSink(() => true, promise)).not.toThrow();
  });

  test('trivially succeeds, given a promise that is rejected', () => {
    const promise = Promise.reject(new Error('oy!'));
    expect(() => new EventSink(() => true, promise)).not.toThrow();
  });
});

describe('run()', () => {
  test('processes the first event when it is synchronously known', async () => {
    let callCount   = 0;
    let callGot     = null;
    const processor = (event) => {
      callGot = event;
      callCount++;
    };

    const event = new ChainedEvent(payload1);
    const sink  = new EventSink(processor, event);

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callCount).toBe(1);
    expect(callGot).toBe(event);

    sink.stop();
    expect(await runResult).toBeNull();
  });

  test('processes the first event when it is promise that resolves to an event', async () => {
    let callCount   = 0;
    let callGot     = null;
    const processor = (event) => {
      callGot = event;
      callCount++;
    };

    const event = new ChainedEvent(payload1);
    const sink = new EventSink(processor, Promise.resolve(event));

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callCount).toBe(1);
    expect(callGot).toBe(event);

    sink.stop();
    expect(await runResult).toBeNull();
  });

  test('processes the first "event" when it is promise that is rejected', async () => {
    let callCount   = 0;
    const processor = (event_unused) => {
      callCount++;
    };

    const reason = new Error('Oh forsooth!');
    const sink   = new EventSink(processor, Promise.reject(reason));

    const runResult = sink.run();
    PromiseUtil.handleRejection(runResult);

    await timers.setImmediate();
    expect(callCount).toBe(0);

    sink.stop();
    await expect(runResult).rejects.toBe(reason);
  });

  test('stops in reaction to the processor throwing', async () => {
    let callCount   = 0;
    let callGot     = null;
    const reason    = new Error('Oh for the love of muffins!');
    const processor = (event) => {
      callGot = event;
      callCount++;
      throw reason;
    };

    const event = new ChainedEvent(payload1);
    const sink  = new EventSink(processor, event);

    const runResult = sink.run();
    PromiseUtil.handleRejection(runResult);

    await timers.setImmediate();
    expect(callCount).toBe(1);
    expect(callGot).toBe(event);

    sink.stop();
    await expect(runResult).rejects.toBe(reason);
  });

  test('processes 10 synchronously-known events', async () => {
    const events = [];

    let emitter = null;
    for (let i = 0; i < 10; i++) {
      if (!emitter) {
        events[0] = new ChainedEvent({ num: i });
      } else {
        emitter = emitter({ num: i});
        events.push(events[i - 1].nextNow);
      }
    }

    let callCount = 0;
    const processor = (event) => {
      if (event !== events[callCount]) {
        throw new Error(`Wrong event #${callCount}`);
      }
      callCount++;
    };

    const sink  = new EventSink(processor, events[0]);

    const runResult = sink.run();
    await timers.setImmediate();
    expect(callCount).toBe(events.length);

    sink.stop();
    expect(await runResult).toBeNull();
  });

  test('processes 10 asynchronously-known events', async () => {
    let callCount = 0;
    const processor = (event) => {
      if (event.payload.num !== callCount) {
        throw new Error(`Wrong event #${callCount}`);
      }
      callCount++;
    };

    let event   = new ChainedEvent({ num: 0 });
    let emitter = event.emitter;
    const sink  = new EventSink(processor, Promise.resolve(event));

    const runResult = sink.run();

    for (let i = 1; i < 10; i++) {
      expect(callCount).toBe(i - 1);
      await timers.setImmediate();
      expect(callCount).toBe(i);
      emitter = emitter({ num: i });
    }

    await timers.setImmediate();
    expect(callCount).toBe(10);

    sink.stop();
    expect(await runResult).toBeNull();
  });
});

describe('stop()', () => {
  test('trivially succeeds on a stopped instance', async () => {
    let callCount   = 0;
    const processor = (event_unused) => {
      callCount++;
    };

    const sink = new EventSink(processor, new ChainedEvent(payload1));

    sink.stop();
    await timers.setImmediate();
    expect(callCount).toBe(0);
  });

  test('prevents any events from being processed if called synchronously after `run()`', async () => {
    let callCount   = 0;
    const processor = (event_unused) => {
      callCount++;
    };

    const sink = new EventSink(processor, new ChainedEvent(payload1));

    const runResult = sink.run();
    sink.stop();
    await timers.setImmediate();
    expect(callCount).toBe(0);

    expect (await runResult).toBeNull();
  });
});
