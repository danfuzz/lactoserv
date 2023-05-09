// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { EventPayload, EventSink, LinkedEvent, ManualPromise, PromiseState,
  PromiseUtil }
  from '@this/async';


const payload1 = new EventPayload('wacky');
const payload2 = new EventPayload('zany', 'z');
const payload3 = new EventPayload('fantastic', ['f', 'a', 'n'], 123);

describe('constructor(<invalid>, event)', () => {
  test.each([
    [null],
    [true],
    [123],
    ['not-a-function'],
    [['also', 'not', 'a', 'function']]
  ])('%p fails', (value) => {
    const event = new LinkedEvent(payload1);
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
    const event = new LinkedEvent(payload1);
    expect(() => new EventSink(() => true, event)).not.toThrow();
  });
});

describe('constructor(function, promise)', () => {
  test('trivially succeeds, given a promise that resolves to an event', () => {
    const promise = Promise.resolve(new LinkedEvent(payload1));
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

describe('.currentEvent', () => {
  test('returns the initially-given event before the instance is started', async () => {
    const event = new LinkedEvent(payload1);
    const sink  = new EventSink(() => true, event);

    expect(await sink.currentEvent).toBe(event);
  });

  test('returns a promise for the first unresolved event, after being drained and stopped', async () => {
    const event = new LinkedEvent(payload1);
    const sink  = new EventSink(() => true, event);

    const runResult = sink.run();
    await timers.setImmediate();
    const stopResult = sink.drainAndStop();
    await expect(runResult).toResolve();
    await expect(stopResult).toResolve();

    const got = sink.currentEvent;
    expect(PromiseState.isPending(got)).toBeTrue();
    event.emitter(payload2);
    const event2 = event.nextNow;
    await timers.setImmediate();
    expect(PromiseState.isFulfilled(got)).toBeTrue();
    expect((await got).payload).toBe(event2.payload);
  });
});

describe('drainAndStop()', () => {
  test('processes all synchronously known events before stopping', async () => {
    const event3  = new LinkedEvent(payload3);
    const event2  = new LinkedEvent(payload2, event3);
    const event1  = new LinkedEvent(payload1, event2);

    let callCount = 0;
    let runProcessor = false;
    const processor = async () => {
      while (!runProcessor) {
        await timers.setImmediate();
      }
      callCount++;
      runProcessor = false;
    };

    const mp   = new ManualPromise();
    const sink = new EventSink(processor, mp.promise);

    const runResult = sink.run();
    await timers.setImmediate();
    mp.resolve(event1);
    runProcessor = true;
    while (callCount === 0) {
      await timers.setImmediate();
    }
    expect(callCount).toBe(1); // Baseline expectation.

    // The actual test.
    const result = sink.drainAndStop();
    while (callCount < 3) {
      runProcessor = true;
      await timers.setImmediate();
    }
    expect(PromiseState.isFulfilled(result)).toBeTrue();

    expect(await runResult).toBeUndefined();
  });

  test('processes events that came in concurrently with a stop request', async () => {
    const event2 = new LinkedEvent(payload2);
    const event1 = new LinkedEvent(payload1, event2);

    let callCount = 0;
    const processor = async () => {
      callCount++;
    };

    const mp   = new ManualPromise();
    const sink = new EventSink(processor, mp.promise);

    const runResult = sink.run();
    await timers.setImmediate();

    // At this point, the run loop should be stuck waiting for either an event
    // or a stop request. The point of this test is to see that an available
    // event _does_ get processed when in this state and asked to drain.

    const result = sink.drainAndStop();
    mp.resolve(event1);
    expect(callCount).toBe(0);           // Baseline expectation.
    expect(sink.isRunning()).toBeTrue(); // Likewise.

    await timers.setImmediate();
    expect(callCount).toBe(2);
    expect(sink.isRunning()).toBeFalse();

    expect(await runResult).toBeUndefined();
    expect(await result).toBeUndefined();
  });

  test('does not cause regular `stop()` to drain, after being restarted', async () => {
    const event3  = new LinkedEvent(payload3);
    const event2  = new LinkedEvent(payload2, event3);
    const event1  = new LinkedEvent(payload1, event2);
    let callCount = 0;
    let runProcessor = false;
    const processor = async () => {
      while (!runProcessor) {
        await timers.setImmediate();
      }
      callCount++;
      runProcessor = false;
    };

    const mp   = new ManualPromise();
    const sink = new EventSink(processor, mp.promise);

    // The setup: Do a first run that ends with a call to drain.
    const runResult1 = sink.run();
    await timers.setImmediate();
    await expect(sink.drainAndStop()).toResolve();
    await expect(runResult1).toResolve();

    // The actual test.
    const runResult2 = sink.run();
    await timers.setImmediate();
    mp.resolve(event1);
    runProcessor = true;
    while (callCount === 0) {
      await timers.setImmediate();
    }
    expect(callCount).toBe(1); // Baseline expectation.

    // The actual test.
    const result = sink.stop();
    while (PromiseState.isPending(result)) {
      runProcessor = true;
      await timers.setImmediate();
    }
    expect(PromiseState.isFulfilled(result)).toBeTrue();
    expect(callCount).toBe(2); // The crux of the test: _not_ 3!

    expect(await runResult2).toBeUndefined();
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

    const event = new LinkedEvent(payload1);
    const sink  = new EventSink(processor, event);

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callCount).toBe(1);
    expect(callGot).toBe(event);

    sink.stop();
    expect(await runResult).toBeUndefined();
  });

  test('processes the first event when it is a promise that resolves to an event', async () => {
    let callCount   = 0;
    let callGot     = null;
    const processor = (event) => {
      callGot = event;
      callCount++;
    };

    const event = new LinkedEvent(payload1);
    const sink = new EventSink(processor, Promise.resolve(event));

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callCount).toBe(1);
    expect(callGot).toBe(event);

    sink.stop();
    expect(await runResult).toBeUndefined();
  });

  test('processes the first "event" when it is a promise that is rejected', async () => {
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

    const event = new LinkedEvent(payload1);
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
        events[0] = new LinkedEvent(new EventPayload('num', i));
      } else {
        emitter = emitter(new EventPayload('num', i));
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
    expect(await runResult).toBeUndefined();
  });

  test('processes 10 asynchronously-known events', async () => {
    let callCount = 0;
    const processor = (event) => {
      if (event.payload.args[0] !== callCount) {
        throw new Error(`Wrong event #${callCount}`);
      }
      callCount++;
    };

    const event0 = new LinkedEvent(new EventPayload('num', 0));
    let emitter  = event0.emitter;
    const sink   = new EventSink(processor, Promise.resolve(event0));

    const runResult = sink.run();

    for (let i = 1; i < 10; i++) {
      expect(callCount).toBe(i - 1);
      await timers.setImmediate();
      expect(callCount).toBe(i);
      emitter = emitter(new EventPayload('num', i));
    }

    await timers.setImmediate();
    expect(callCount).toBe(10);

    sink.stop();
    expect(await runResult).toBeUndefined();
  });

  test('can be `stop()`ed and then re-`run()`', async () => {
    let callCount   = 0;
    let callGot     = null;
    const processor = (event) => {
      callGot = event;
      callCount++;
    };

    const event1 = new LinkedEvent(payload1);
    const sink   = new EventSink(processor, event1);

    // Baseline expectations.
    const runResult1 = sink.run();
    await timers.setImmediate();
    expect(callCount).toBe(1);
    expect(callGot).toBe(event1);
    sink.stop();
    expect(await runResult1).toBeUndefined();

    // The actual test.

    event1.emitter(payload2);
    const event2 = event1.nextNow;

    const runResult2 = sink.run();
    await timers.setImmediate();
    expect(callCount).toBe(2);
    expect(callGot).toBe(event2);
    sink.stop();
    expect(await runResult2).toBeUndefined();
  });
});

describe('stop()', () => {
  test('trivially succeeds on a stopped instance', async () => {
    let callCount   = 0;
    const processor = (event_unused) => {
      callCount++;
    };

    const sink = new EventSink(processor, new LinkedEvent(payload1));

    sink.stop();
    await timers.setImmediate();
    expect(callCount).toBe(0);
  });

  test('prevents any events from being processed if called synchronously after `run()`', async () => {
    let callCount   = 0;
    const processor = (event_unused) => {
      callCount++;
    };

    const sink = new EventSink(processor, new LinkedEvent(payload1));

    const runResult = sink.run();
    sink.stop();
    await timers.setImmediate();
    expect(callCount).toBe(0);

    expect (await runResult).toBeUndefined();
  });
});

describe('processor function calling', () => {
  test('called with a single event argument (synchronously known)', async () => {
    let callGot     = null;
    const processor = (...args) => {
      callGot = args;
    };

    const event = new LinkedEvent(payload1);
    const sink  = new EventSink(processor, event);

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callGot).toStrictEqual([event]);

    sink.stop();
    expect(await runResult).toBeUndefined();
  });

  test('called with a single event argument (resolved promise)', async () => {
    let callGot     = null;
    const processor = (...args) => {
      callGot = args;
    };

    const event = new LinkedEvent(payload1);
    const sink  = new EventSink(processor, Promise.resolve(event));

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callGot).toStrictEqual([event]);

    sink.stop();
    expect(await runResult).toBeUndefined();
  });

  test('called with `this` unbound', async () => {
    let callGotThis = null;
    function processor() {
      callGotThis = this;
    }

    const event = new LinkedEvent(payload1);
    const sink  = new EventSink(processor, event);

    const runResult = sink.run();

    await timers.setImmediate();
    expect(callGotThis).toBeNull();

    sink.stop();
    expect(await runResult).toBeUndefined();
  });
});
