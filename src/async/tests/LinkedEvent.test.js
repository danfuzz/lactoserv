// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { EventPayload, LinkedEvent, ManualPromise, PromiseState } from '@this/async';


const payload1 = new EventPayload('wacky');
const payload2 = new EventPayload('zany');
const payload3 = new EventPayload('questionable');

describe.each`
  label                   | args
  ${'payload'}            | ${[payload1]}
  ${'payload, null'}      | ${[payload1, null]}
  ${'payload, undefined'} | ${[payload1, undefined]}
`('constructor($label)', ({ args }) => {
  test('constructs an instance', async () => {
    expect(() => new LinkedEvent(...args)).not.toThrow();
  });

  test('does not have a `nextNow`', () => {
    const event = new LinkedEvent(...args);
    expect(event.nextNow).toBeNull();
  });

  test('has an unsettled `nextPromise`', async () => {
    const event = new LinkedEvent(...args);

    await timers.setImmediate();
    expect(PromiseState.isSettled(event.nextPromise)).toBeFalse();
  });

  test('has an available `emitter`', () => {
    const event = new LinkedEvent(...args);
    expect(() => event.emitter).not.toThrow();
  });
});

describe('constructor(payload, next: <invalid>)', () => {
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
    expect(() => new LinkedEvent(payload1, value)).toThrow();
  });
});

describe('constructor(payload, next: LinkedEvent)', () => {
  test('constructs an instance', async () => {
    const next = new LinkedEvent(payload1);
    expect(() => new LinkedEvent(payload2, next)).not.toThrow();
  });

  test('has the expected `nextNow`', () => {
    const next  = new LinkedEvent(payload1);
    const event = new LinkedEvent(payload2, next);
    expect(event.nextNow).toBe(next);
  });

  test('has `next` that resolves promptly as expected', async () => {
    const next  = new LinkedEvent(payload1);
    const event = new LinkedEvent(payload2, next);
    expect(await event.nextPromise).toBe(next);
  });

  test('does not have an available `emitter`', () => {
    const next  = new LinkedEvent(payload1);
    const event = new LinkedEvent(payload2, next);
    expect(() => event.emitter).toThrow();
  });
});

describe('constructor(payload, next: Promise)', () => {
  test('constructs an instance', async () => {
    const mp = new ManualPromise();
    expect(() => new LinkedEvent(payload1, mp.promise)).not.toThrow();
  });

  test('`nextNow === null`', () => {
    const mp    = new ManualPromise();
    const event = new LinkedEvent(payload1, mp.promise);
    expect(event.nextNow).toBeNull();
  });

  test('has unsettled `nextPromise`', async () => {
    const mp    = new ManualPromise();
    const event = new LinkedEvent(payload1, mp.promise);

    await timers.setImmediate();
    expect(PromiseState.isSettled(event.nextPromise)).toBeFalse();
  });

  test('does not have an available `emitter`', () => {
    const mp    = new ManualPromise();
    const event = new LinkedEvent(payload1, mp.promise);
    expect(() => event.emitter).toThrow();
  });

  test('has a `nextPromise` that tracks incoming `next`', async () => {
    const mp    = new ManualPromise();
    const event = new LinkedEvent(payload1, mp.promise);
    const next  = new LinkedEvent(payload2);

    mp.resolve(next);

    expect(await event.nextPromise).toBe(next);
  });

  test('has a `nextNow` that tracks incoming `next`', async () => {
    const mp    = new ManualPromise();
    const event = new LinkedEvent(payload1, mp.promise);
    const next  = new LinkedEvent(payload2);

    mp.resolve(next);

    // We have to wait for `event.nextPromise` to resolve before we can expect
    // `nextNow` to be set.
    await event.nextPromise;

    expect(event.nextNow).toBe(next);
  });
});

describe('constructor(payload, next: Promise) -- invalid resolution', () => {
  describe('when `next` resolves to an invalid instance', () => {
    test('`nextNow` throws', async () => {
      const mp    = new ManualPromise();
      const event = new LinkedEvent(payload1, mp.promise);

      mp.resolve(new Set('not an instance of the right class'));

      // We have to let `event.nextPromise` become resolved before we can tell
      // that `event.nextNow` is correctly not-set.
      try {
        await event.nextPromise;
      } catch {
        // Just swallow the error for the purposes of this test.
      }

      expect(() => event.nextNow).toThrow();
    });

    test('has `nextPromise` that becomes rejected', async () => {
      const mp    = new ManualPromise();
      const event = new LinkedEvent(payload1, mp.promise);

      mp.resolve('not an instance at all');

      await expect(event.nextPromise).rejects.toThrow();
    });
  });

  describe('when `nextPromise` becomes rejected', () => {
    test('`nextNow` throws for the same reason', async () => {
      const mp     = new ManualPromise();
      const event  = new LinkedEvent(payload1, mp.promise);
      const reason = new Error('Oh biscuits.');

      mp.reject(reason);

      // We have to let `event.nextPromise` become rejected before we can tell
      // that `event.nextNow` is correctly not-set.
      try {
        await event.nextPromise;
      } catch {
        // Just swallow the error for the purposes of this test.
      }

      expect(() => event.nextNow).toThrow(reason);
    });

    test('has `nextPromise` that becomes rejected for the same reason', async () => {
      const mp     = new ManualPromise();
      const event  = new LinkedEvent(payload1, mp.promise);
      const reason = new Error('forsooth');

      mp.reject(reason);

      await expect(event.nextPromise).rejects.toBe(reason);
    });
  });
});

describe('.emitter', () => {
  test('returns something the first time it is called', () => {
    const event = new LinkedEvent(payload1);

    expect(() => event.emitter).not.toThrow();
  });

  test('throws on the second (or later) use', () => {
    const event = new LinkedEvent(payload1);

    event.emitter;
    expect(() => event.emitter).toThrow();
    expect(() => event.emitter).toThrow();
    expect(() => event.emitter).toThrow();
    expect(() => event.emitter).toThrow();
    expect(() => event.emitter).toThrow();
  });

  test('returns a function which causes the next event to be chained', () => {
    const event = new LinkedEvent(payload1);

    expect(() => event.emitter(payload2)).not.toThrow();
    expect(event.nextNow).not.toBeNull();
    expect(event.nextNow?.payload).toBe(payload2);
  });

  test('returns a function which only works once', () => {
    const event = new LinkedEvent(payload1);
    const emitter = event.emitter;

    expect(() => emitter(payload2)).not.toThrow();

    expect(() => emitter(payload2)).toThrow();
    expect(() => emitter(payload2)).toThrow();
    expect(() => emitter(payload2)).toThrow();
    expect(() => emitter(payload2)).toThrow();
    expect(() => emitter(payload2)).toThrow();
  });

  test('returns a function which requires the payload to be an `instanceof` this class\'s payload', () => {
    class SomePayload extends EventPayload {
      // This space intentionally left blank.
    }

    const event   = new LinkedEvent(new SomePayload('beep', 1, 2, 3));
    const emitter = event.emitter;

    expect(() => emitter(new EventPayload('blorp'))).toThrow();
    expect(() => emitter(new SomePayload('blorp'))).not.toThrow();
  });
});

describe('.nextNow', () => {
  test('is `null` if there is no next event', () => {
    const event = new LinkedEvent(payload1);

    expect(event.nextNow).toBeNull();
  });

  test('is the next event once emitted', () => {
    const event = new LinkedEvent(payload1);

    event.emitter(payload2);

    const got = event.nextNow;
    expect(got.payload).toBe(payload2);
  });

  test('is the just-next event even after more have been emitted', () => {
    const event = new LinkedEvent(payload1);

    event.emitter(payload2)(payload1);

    const got = event.nextNow;
    expect(got.payload).toBe(payload2);
  });
});

describe('.nextPromise', () => {
  test('is an unsettled promise if there is no next event', async () => {
    const event = new LinkedEvent(payload1);

    await timers.setImmediate();
    expect(PromiseState.isSettled(event.nextPromise)).toBeFalse();
  });

  test('eventually resolves to the chained event', async () => {
    const event = new LinkedEvent(payload1);

    (async () => {
      await timers.setTimeout(10);
      event.emitter(payload2);
    })();

    const got = await event.nextPromise;
    expect(got.payload).toBe(payload2);
  });
});

describe('.payload', () => {
  test('is the payload from construction', async () => {
    const event = new LinkedEvent(payload1);

    expect(event.payload).toBe(payload1);
  });
});

describe('.type', () => {
  test('is the `type` of the payload from construction', async () => {
    const type  = 'bleep';
    const event = new LinkedEvent({ x: 'florp', type });

    expect(event.type).toBe(type);
  });
});

describe('withPayload()', () => {
  test('produces an instance with the indicated payload', () => {
    const event  = new LinkedEvent(payload1);
    const result = event.withPayload(payload2);

    expect(result.payload).toBe(payload2);
  });

  test('produces an instance whose `nextNow` tracks the original', async () => {
    const event  = new LinkedEvent(payload1);
    const result = event.withPayload(payload2);

    expect(result.nextNow).toBeNull();

    event.emitter(payload3);
    expect(event.nextNow).not.toBeNull();
    expect(event.nextNow?.payload).toBe(payload3);

    // The result is expected to be `await`ing the original's `nextPromise`, so
    // we can't expect its `nextNow` to be non-`null` until after its own
    // `nextPromise` resolves.

    await result.nextPromise;
    expect(result.nextNow).not.toBeNull();
    expect(result.nextNow?.payload).toBe(payload3);
  });

  test('produces an instance whose `nextNow` is immediately ready if the ' +
      'original already has its own `nextNow`', async () => {
    const event = new LinkedEvent(payload1);

    event.emitter(payload3);

    const result = event.withPayload(payload2);
    expect(result.nextNow).not.toBeNull();
    expect(result.nextNow?.payload).toBe(payload3);
  });

  test('produces an instance whose `nextPromise` tracks the original', async () => {
    const event  = new LinkedEvent(payload1);
    const result = event.withPayload(payload2);

    await timers.setImmediate();
    expect(PromiseState.isSettled(event.nextPromise)).toBeFalse();

    event.emitter(payload3);

    const eventNext  = await event.nextPromise;
    const resultNext = await result.nextPromise;
    expect(eventNext.payload).toBe(payload3);
    expect(resultNext.payload).toBe(payload3);
  });

  test('produces an instance whose `.emitter` is unavailable', () => {
    const event = new LinkedEvent(payload1);

    // Before `event` has a next.
    const result1 = event.withPayload(payload2);
    expect(() => result1.emitter).toThrow();

    // After `event` has a next.
    event.emitter(payload3);
    const result2 = event.withPayload(payload2);
    expect(() => result2.emitter).toThrow();
  });

  test('fails if the given payload does not match the class of the existing payload', () => {
    class SomePayload extends EventPayload {
      // This space intentionally left blank.
    }

    const event = new LinkedEvent(new SomePayload('boop'));
    expect(() => event.withPayload(payload1)).toThrow();
    expect(() => event.withPayload(new SomePayload('bop'))).not.toThrow();
  });
});

describe('withPushedHead()', () => {
  test('produces an instance with the indicated payload', () => {
    const event  = new LinkedEvent(payload1);
    const result = event.withPushedHead(payload2);

    expect(result.payload).toBe(payload2);
  });

  test('produces an instance whose `nextNow` is the original instance', () => {
    const event  = new LinkedEvent(payload1);
    const result = event.withPushedHead(payload2);

    expect(result.nextNow).toBe(event);
  });

  test('produces an instance whose `nextPromise` is the original instance', async () => {
    const event  = new LinkedEvent(payload1);
    const result = event.withPushedHead(payload2);

    expect(await result.nextPromise).toBe(event);
  });

  test('produces an instance whose `.emitter` is unavailable', () => {
    // When the original event doesn't yet have a `next`.
    const event1  = new LinkedEvent(payload1);
    const result1 = event1.withPushedHead(payload2);
    expect(() => result1.emitter).toThrow();

    // When the original event already has a `next`.
    const event2  = new LinkedEvent(payload1, new LinkedEvent(payload3));
    const result2 = event2.withPushedHead(payload2);
    expect(() => result2.emitter).toThrow();
  });

  test('fails if the given payload does not match the class of the existing payload', () => {
    class SomePayload extends EventPayload {
      // This space intentionally left blank.
    }

    const event = new LinkedEvent(new SomePayload('boop'));
    expect(() => event.withPushedHead(payload1)).toThrow();
    expect(() => event.withPushedHead(new SomePayload('bop'))).not.toThrow();
  });
});

describe('subclass behavior', () => {
  class FlorpEvent extends LinkedEvent {
    // This space intentionally left blank.
  }

  test('constructs instances of the subclass when emitting', () => {
    const event1 = new FlorpEvent(payload1);
    event1.emitter(payload2);

    expect(event1.nextNow).toBeInstanceOf(FlorpEvent);
  });

  test('rejects a promised `next` that is not of the subclass', async () => {
    const mp     = new ManualPromise();
    const event  = new FlorpEvent(payload1, mp.promise);
    const baddie = new LinkedEvent(payload2);

    mp.resolve(baddie);

    await expect(event.nextPromise).rejects.toThrow();
    expect(() => event.nextNow).toThrow();
  });
});
