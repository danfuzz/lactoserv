// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Mutex } from '@this/async';


describe('lock()', () => {
  test('works when there is blatantly no contention', async () => {
    const mutex = new Mutex();
    const unlock = await mutex.lock();

    expect(unlock).toBeFunction();
    unlock();
  });

  test('rejects attempts to double-unlock with the same unlocker', async () => {
    const mutex = new Mutex();
    const unlock = await mutex.lock();

    unlock();
    expect(unlock).toThrow();
  });

  test('provides the lock in request order', async () => {
    const mutex       = new Mutex();
    const gotOrder    = [];
    const expectOrder = [];
    const innerProms  = [];

    // Get the lock, so we know there is contention when we make the
    // additional lock calls.
    const outerUnlock = await mutex.lock();

    // All of these `lock()`s will be queued up.
    for (let i = 0; i < 10; i++) {
      const unlockProm = mutex.lock();
      expectOrder.push(i);
      innerProms.push((async () => {
        const unlock = await unlockProm;
        gotOrder.push(i);
        unlock();
      })());
    }

    outerUnlock();

    // Wait for all the inner lock/unlock blocks (above) to run to completion.
    await Promise.all(innerProms);

    expect(gotOrder).toStrictEqual(expectOrder);
  });
});

describe('serialize()', () => {
  test('works with a synchronous function when there is blatantly no contention', async () => {
    const mutex = new Mutex();

    const result1 = mutex.serialize(() => { return 'blort'; });
    expect(await result1).toBe('blort');

    const result2 = mutex.serialize(() => { throw new Error('oy'); });
    await expect(result2).rejects.toThrow();
  });

  test('works with an `async` function when there is blatantly no contention', async () => {
    const mutex = new Mutex();

    const result1 = mutex.serialize(async () => { return 'blort'; });
    expect(await result1).toBe('blort');

    const result2 = mutex.serialize(async () => { throw new Error('oy'); });
    await expect(result2).rejects.toThrow();
  });

  test('provides the lock in request order', async () => {
    const mutex = new Mutex();

    let result = 'x';
    const promises = [];

    for (let i = 0; i < 10; i++) {
      const p = mutex.serialize(() => { result += `${i}`; });
      promises.push(p);
    }

    await Promise.all(promises);
    expect(result).toBe('x0123456789');
  });

  test('rejects non-function arguments', async () => {
    const mutex = new Mutex();
    const test = async (v) => {
      await expect(mutex.serialize(v)).rejects.toThrow();
    };

    await test(null);
    await test(undefined);
    await test(123);
    await test('foo');
    await test(Mutex);
  });
});
