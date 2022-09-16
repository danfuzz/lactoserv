// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '@this/async';

import * as timers from 'node:timers/promises';


const payload1 = { type: 'wacky' };
const payload2 = { type: 'zany' };
const payload3 = { type: 'questionable' };

describe('constructor()', () => {
  test('constructs an instance', async () => {
    expect(() => new ChainedEvent(payload1)).not.toThrow();
  });
});

describe('.next', () => {
  test('is an unresolved promise if there is no next event', async () => {
    const event = new ChainedEvent(payload1);

    const race = await Promise.race([event.next, timers.setImmediate(123)]);
    expect(race).toBe(123);
  });

  test('eventually resolves to the chained event', async () => {
    const event = new ChainedEvent(payload1);

    (async () => {
      await timers.setTimeout(10);
      event.emitter(payload2);
    })();

    const got = await event.next;
    expect(got.payload).toBe(payload2);
  });
});

describe('.nextNow', () => {
  test('is `null` if there is no next event', () => {
    const event = new ChainedEvent(payload1);

    expect(event.nextNow).toBeNull();
  });

  test('is the next event once emitted', () => {
    const event = new ChainedEvent(payload1);

    event.emitter(payload2);

    const got = event.nextNow;
    expect(got.payload).toBe(payload2);
  });

  test('is the just-next event even after more have been emitted', () => {
    const event = new ChainedEvent(payload1);

    event.emitter(payload2)(payload1);

    const got = event.nextNow;
    expect(got.payload).toBe(payload2);
  });
});

describe('withNewPayload()', () => {
  test('produces an instance with the indicated payload', () => {
    const event  = new ChainedEvent(payload1);
    const result = event.withNewPayload(payload2);

    expect(result.payload).toBe(payload2);
  });

  test('produces an instance whose `nextNow` tracks the original', async () => {
    const event  = new ChainedEvent(payload1);
    const result = event.withNewPayload(payload2);

    expect(result.nextNow).toBeNull();

    event.emitter(payload3);
    expect(event.nextNow).not.toBeNull();
    expect(event.nextNow?.payload).toBe(payload3);

    // The result is expected to be `await`ing the original's `next`, so we
    // can't expect its `nextNow` to be non-`null` until after its own `next`
    // resolves.

    await result.next;
    expect(result.nextNow).not.toBeNull();
    expect(result.nextNow?.payload).toBe(payload3);
  });

  test('produces an instance whose `nextNow` is immediately ready if the ' +
      'original already has its own `nextNow`', async () => {
    const event = new ChainedEvent(payload1);

    event.emitter(payload3);

    const result = event.withNewPayload(payload2);
    expect(result.nextNow).not.toBeNull();
    expect(result.nextNow?.payload).toBe(payload3);
  });

  test('produces an instance whose `next` tracks the original', async () => {
    const event  = new ChainedEvent(payload1);
    const result = event.withNewPayload(payload2);

    const race = await Promise.race([event.next, timers.setImmediate(123)]);
    expect(race).toBe(123);

    event.emitter(payload3);

    const eventNext  = await event.next;
    const resultNext = await result.next;
    expect(eventNext.payload).toBe(payload3);
    expect(resultNext.payload).toBe(payload3);
  });
});

/*
describe('withPushedHead()', () => {
  test('produces an instance with the default payload', () => {
    const source = new EventSource();
    const event  = source.emit.blort(1, 2, 3);
    const result = event.withPushedHead();

    assert.strictEqual(result.payload.name, 'none');
    assert.strictEqual(result.payload.args.length, 0);
  });
});

describe('withPushedHead(payload)', () => {
  test('produces an instance with the indicated payload', () => {
    const source = new EventSource();
    const event  = source.emit.blort(1, 2, 3);
    const expect = new Functor('florp', 'x');
    const result = event.withPushedHead(expect);

    assert.strictEqual(result.payload, expect);
  });

  test('produces an instance with `next` bound a promise to the original event',
      async () => {
    const source = new EventSource();
    const event  = source.emit.blort(1, 2, 3);
    const result = event.withPushedHead(new Functor('florp'));

    const next = await result.next;
    assert.strictEqual(next, event);
  });

  test('produces an instance with `nextNow` bound to the original event',
      () => {
    const source = new EventSource();
    const event  = source.emit.blort(1, 2, 3);
    const result = event.withPushedHead(new Functor('florp'));

    assert.strictEqual(result.nextNow, event);
  });
});
*/
