// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { ManualPromise, PromiseState, TokenBucket } from '@this/async';

/**
 * Mock implementation of `BaseTimeSource`.
 */
class MockTimeSource extends TokenBucket.BaseTimeSource {
  #now      = 0;
  #timeouts = [];

  constructor(firstNow = 0) {
    super();
    this.#now = firstNow;
  }

  get unitName() {
    return 'some-unit';
  }

  now() {
    return this.#now;
  }

  async waitUntil(time) {
    if (time <= this.#now) {
      return;
    }

    const mp = new ManualPromise();
    this.#timeouts.push({
      at:      time,
      resolve: () => mp.resolve()
    });

    await mp.promise;
  }

  _end() {
    for (const t of this.#timeouts) {
      t.resolve();
    }
  }

  _setTime(now) {
    this.#now = now;
    this.#timeouts.sort((a, b) => {
      if (a.at < b.at) return -1;
      if (a.at > b.at) return 1;
      return 0;
    });
    while (this.#timeouts[0]?.at <= now) {
      this.#timeouts[0].resolve();
      this.#timeouts.shift();
    }
  }
}

describe('constructor()', () => {
  test.each`
    opts
    ${{ maxBurstSize: 1, flowRate: 1 }}
    ${{ maxBurstSize: 0.01, flowRate: 0.0001 }}
    ${{ maxBurstSize: 200000, flowRate: 109 }}
    ${{ maxBurstSize: 1, flowRate: 1, initialBurstSize: 0 }}
    ${{ maxBurstSize: 1, flowRate: 1, initialBurstSize: 1 }}
    ${{ maxBurstSize: 10, flowRate: 1, initialBurstSize: 10 }}
    ${{ maxBurstSize: 10, flowRate: 1, initialBurstSize: 9 }}
    ${{ maxBurstSize: 1, flowRate: 1, maxQueueGrantSize: 0.1 }}
    ${{ maxBurstSize: 1, flowRate: 1, maxQueueGrantSize: 1 }}
    ${{ maxBurstSize: 100, flowRate: 1, maxQueueGrantSize: 1 }}
    ${{ maxBurstSize: 100, flowRate: 1, maxQueueGrantSize: 50 }}
    ${{ maxBurstSize: 100, flowRate: 1, maxQueueGrantSize: 99 }}
    ${{ maxBurstSize: 1, flowRate: 1, maxWaiters: 1000 }}
    ${{ maxBurstSize: 1, flowRate: 1, maxWaiters: 0 }}
    ${{ maxBurstSize: 1, flowRate: 1, maxWaiters: 1 }}
    ${{ maxBurstSize: 1, flowRate: 1, maxWaiters: 1000 }}
    ${{ maxBurstSize: 1, flowRate: 1, partialTokens: false }}
    ${{ maxBurstSize: 123.456, flowRate: 12.3, partialTokens: false }}
    ${{ maxBurstSize: 1, flowRate: 1, partialTokens: true }}
    ${{ maxBurstSize: 1, flowRate: 1, timeSource: new TokenBucket.StdTimeSource() }}
    ${{ maxBurstSize: 1, flowRate: 1, timeSource: new MockTimeSource() }}
    ${{ maxBurstSize: 1, flowRate: 1, initialBurstSize: 0.5, maxQueueGrantSize: 0.5,
        maxWaiters: 10, partialTokens: true, timeSource: new MockTimeSource() }}
  `('trivially accepts valid options: $opts', ({ opts }) => {
    expect(() => new TokenBucket(opts)).not.toThrow();
  });

  test('produces an instance with the `maxBurstSize` that was passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 123 });
    expect(bucket.config.maxBurstSize).toBe(123);
  });

  test('produces an instance with the `flowRate` that was passed', () => {
    const bucket = new TokenBucket({ flowRate: 1234, maxBurstSize: 100000 });
    expect(bucket.config.flowRate).toBe(1234);
  });

  test.each`
    maxQueueGrantSize
    ${0.1}
    ${1}
    ${200}
  `('produces an instance with the `maxQueueGrantSize` that was passed: $maxQueueGrantSize', ({ maxQueueGrantSize }) => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1000, maxQueueGrantSize });
    expect(bucket.config.maxQueueGrantSize).toBe(maxQueueGrantSize);
  });

  test('has `maxQueueGrantSize === maxBurstSize` if not passed `maxQueueGrantSize`', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 10203 });
    expect(bucket.config.maxQueueGrantSize).toBe(10203);
  });

  test.each`
    maxWaiters
    ${null}
    ${0}
    ${10}
  `('produces an instance with the `maxWaiters` that was passed: $maxWaiters', ({ maxWaiters }) => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1, maxWaiters });
    expect(bucket.config.maxWaiters).toBe(maxWaiters);
  });

  test('has `maxWaiters === null` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1 });
    expect(bucket.config.maxWaiters).toBeNull();
  });

  test.each`
    partialTokens
    ${false}
    ${true}
  `('produces an instance with the `partialTokens` that was passed: $partialTokens', ({ partialTokens }) => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1, partialTokens });
    expect(bucket.config.partialTokens).toBe(partialTokens);
  });

  test('has `partialTokens === false` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1 });
    expect(bucket.config.partialTokens).toBeFalse();
  });

  test('produces an instance which uses the `timeSource` that was passed', () => {
    const ts = new MockTimeSource(321);
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1, timeSource: ts });
    expect(bucket.config.timeSource).toBe(ts);
    expect(bucket.latestState().now).toBe(321);
  });

  test('produces an instance which (apparently) uses the default time source if not passed `timeSource`', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 1 });
    expect(bucket.config.timeSource).toBeNull();
  });

  test('produces an instance with `availableBurst` equal to the passed `initialBurstSize`', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 100, initialBurstSize: 23 });
    expect(bucket.latestState().availableBurst).toBe(23);
  });

  test('has `availableBurst === maxBurstSize` if not passed `initialBurstSize`', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 123 });
    expect(bucket.latestState().availableBurst).toBe(123);
  });

  test('produces an instance with no waiters', () => {
    const bucket = new TokenBucket({ flowRate: 1, maxBurstSize: 100 });
    expect(bucket.latestState().waiters).toBe(0);
  });
});

describe('constructor(<invalid>)', () => {
  test.each`
    arg
    ${undefined}
    ${null}
    ${123}
    ${'hello'}
    ${new Map()}
  `('rejects non-object argument: $arg', ({ arg }) => {
    expect(() => new TokenBucket(arg)).toThrow();
  });

  test('rejects missing `maxBurstSize`', () => {
    expect(() => new TokenBucket({ flowRate: 1 })).toThrow();
  });

  test('rejects missing `flowRate`', () => {
    expect(() => new TokenBucket({ maxBurstSize: 1 })).toThrow();
  });

  test.each`
    maxBurstSize
    ${undefined}
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
    ${0}
    ${NaN}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `maxBurstSize`: $maxBurstSize', ({ maxBurstSize }) => {
    expect(() => new TokenBucket({ maxBurstSize, flowRate: 1 })).toThrow();
  });

  test.each`
    flowRate
    ${undefined}
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
    ${0}
    ${NaN}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `flowRate`: $flowRate', ({ flowRate }) => {
    expect(() => new TokenBucket({ flowRate, maxBurstSize: 1 })).toThrow();
  });

  test.each`
    initialBurstSize
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
  `('rejects invalid `initialBurstSize`: $initialBurstSize', ({ initialBurstSize }) => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, initialBurstSize })).toThrow();
  });

  test('rejects invalid `initialBurstSize` (`> maxBurstSize`)', () => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, initialBurstSize: 1.01 })).toThrow();
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, initialBurstSize: 2 })).toThrow();
  });

  test.each`
    maxQueueGrantSize
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${0}
    ${-1}
    ${-0.1}
  `('rejects invalid `maxQueueGrantSize`: $maxQueueGrantSize', ({ maxQueueGrantSize }) => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1000, maxQueueGrantSize })).toThrow();
  });

  test('rejects invalid `maxQueueGrantSize` (`> maxBurstSize`)', () => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, maxQueueGrantSize: 1.01 })).toThrow();
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, maxQueueGrantSize: 2 })).toThrow();
  });

  test.each`
    maxWaiters
    ${false}
    ${'123'}
    ${[123]}
    ${-1}
    ${0.1}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `maxWaiters`: $maxWaiters', ({ maxWaiters }) => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, maxWaiters })).toThrow();
  });

  test.each`
    partialTokens
    ${null}
    ${'true'}
    ${[false]}
    ${0}
  `('rejects invalid `partialTokens`: $partialTokens', ({ partialTokens }) => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, partialTokens })).toThrow();
  });

  test.each`
    timeSource
    ${null}
    ${[1, 2, 3]}
    ${new Map()}
    ${TokenBucket.BaseTimeSource /* supposed to be an instance, not a class */}
    ${MockTimeSource /* ditto */}
  `('rejects invalid `timeSource`: $timeSource', ({ timeSource }) => {
    expect(() => new TokenBucket({ flowRate: 1, maxBurstSize: 1, timeSource })).toThrow();
  });
});

describe('.config', () => {
  test('has exactly the expected properties', () => {
    const bucket = new TokenBucket({ flowRate: 123, maxBurstSize: 100000 });
    expect(bucket.config).toContainAllKeys([
      'maxBurstSize', 'flowRate', 'maxQueueGrantSize', 'maxWaiters', 'partialTokens',
      'timeSource'
    ]);
  });
});

describe('denyAllRequests()', () => {
  test('causes pending grant requests to in fact be denied', async () => {
    const time   = new MockTimeSource(10000);
    const bucket = new TokenBucket({
      flowRate: 1, maxBurstSize: 1000, initialBurstSize: 0, timeSource: time });

    // Setup / baseline assumptions.
    const result1 = bucket.requestGrant(1);
    const result2 = bucket.requestGrant(2);
    const result3 = bucket.requestGrant(3);
    await timers.setImmediate();
    expect(PromiseState.isPending(result1)).toBeTrue();
    expect(PromiseState.isPending(result2)).toBeTrue();
    expect(PromiseState.isPending(result3)).toBeTrue();

    // The actual test.

    const result = bucket.denyAllRequests();
    time._setTime(10987);
    expect(PromiseState.isPending(result)).toBeTrue();
    await timers.setImmediate();
    expect(PromiseState.isFulfilled(result)).toBeTrue();

    expect(PromiseState.isFulfilled(result1)).toBeTrue();
    expect(PromiseState.isFulfilled(result2)).toBeTrue();
    expect(PromiseState.isFulfilled(result3)).toBeTrue();
    expect(await result1).toStrictEqual({ done: false, grant: 0, waitTime: 987 });
    expect(await result2).toStrictEqual({ done: false, grant: 0, waitTime: 987 });
    expect(await result3).toStrictEqual({ done: false, grant: 0, waitTime: 987 });

    time._end();
  });
});

describe('requestGrant()', () => {
  describe('when there are no waiters', () => {
    // TODO
  });

  describe('when there are waiters', () => {
    // TODO
  });

  describe('when `partialTokens === false`', () => {
    test('will not grant a partial token even if otherwise available', () => {
      // TODO
    });
  });

  describe('when `partialTokens === true`', () => {
    test('can actually grant a partial token', () => {
      // TODO
    });
  });
});

describe('latestState()', () => {
  test('has exactly the expected properties', () => {
    const bucket = new TokenBucket({ flowRate: 123, maxBurstSize: 100000 });
    expect(bucket.latestState()).toContainAllKeys([
      'availableBurst', 'now', 'waiters'
    ]);
  });

  test('does not use the time source', () => {
    const time   = new MockTimeSource(900);
    const bucket = new TokenBucket({
      flowRate: 1, maxBurstSize: 10000, initialBurstSize: 100, timeSource: time });

    const baseResult = bucket.latestState();
    expect(baseResult.now).toBe(900);
    expect(baseResult.availableBurst).toBe(100);

    time._setTime(901);
    expect(bucket.latestState()).toStrictEqual(baseResult);

    time.now = () => { throw new Error('oy!'); };
    expect(() => bucket.latestState()).not.toThrow();
  });

  test('indicates a lack of waiters, before any waiting has ever happened', () => {
    const bucket = new TokenBucket({ flowRate: 123, maxBurstSize: 100000 });
    expect(bucket.latestState().waiters).toBe(0);
  });

  test('indicates the number of waiters as the number waxes and wanes', async () => {
    const time   = new MockTimeSource(1000);
    const bucket = new TokenBucket({
      flowRate: 1, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

    const result1 = bucket.requestGrant(1);
    expect(PromiseState.isPending(result1)).toBeTrue();
    expect(bucket.latestState().waiters).toBe(1);

    const result2 = bucket.requestGrant(1);
    expect(PromiseState.isPending(result2)).toBeTrue();
    expect(bucket.latestState().waiters).toBe(2);

    const result3 = bucket.requestGrant(1);
    expect(PromiseState.isPending(result3)).toBeTrue();
    expect(bucket.latestState().waiters).toBe(3);

    time._setTime(1002); // Enough for the first two requests to get granted.
    await timers.setImmediate();
    expect(PromiseState.isFulfilled(result1)).toBeTrue();
    expect(PromiseState.isFulfilled(result2)).toBeTrue();
    expect(bucket.latestState().waiters).toBe(1);

    time._setTime(1003); // Enough for the last request to get granted.
    await timers.setImmediate();
    expect(PromiseState.isFulfilled(result3)).toBeTrue();
    expect(bucket.latestState().waiters).toBe(0);

    time._end();
  });
});

describe('takeNow()', () => {
  describe('when there are no waiters', () => {
    test('succeeds given an exact token quantity and sufficient available burst', () => {
      const now    = 98000;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 1, maxBurstSize: 10000, initialBurstSize: 123, timeSource: time });

      const result = bucket.takeNow(123);
      expect(result).toStrictEqual({ done: true, grant: 123, minWaitUntil: now, maxWaitUntil: now });
      expect(bucket.latestState().availableBurst).toBe(0);
    });

    test('succeeds with as much as is available', () => {
      const now    = 43210;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 5, maxBurstSize: 10000, initialBurstSize: 100, timeSource: time });

      const result = bucket.takeNow({ minInclusive: 10, maxInclusive: 110 });
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(100);
      expect(result.minWaitUntil).toBe(now + 0);
      expect(result.maxWaitUntil).toBe(now + ((110 - 100) / 5));

      expect(bucket.latestState().availableBurst).toBe(0);
    });

    test('succeeds with as much burst capacity as is available', () => {
      const now    = 91400;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 5, maxBurstSize: 10000, initialBurstSize: 75, maxQueueGrantSize: 50, timeSource: time });

      // Notably, this is not supposed to be clamped to `maxQueueGrantSize`,
      // because this request isn't being queued (that is, there's no
      // contention.)
      const result1 = bucket.takeNow({ minInclusive: 10, maxInclusive: 200 });
      expect(result1.done).toBeTrue();
      expect(result1.grant).toBe(75);
      expect(result1.minWaitUntil).toBe(now + 0);
      expect(result1.maxWaitUntil).toBe(now + ((200 - 75) / 5));

      expect(bucket.latestState().availableBurst).toBe(0);
    });

    test('uses the time source', () => {
      const now    = 1000;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 5, maxBurstSize: 100, initialBurstSize: 0, timeSource: time });

      const now1 = now + 1; // Enough for 5 tokens to become available.
      time._setTime(now1);
      const result = bucket.takeNow({ minInclusive: 0, maxInclusive: 10 });
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(5);
      expect(result.minWaitUntil).toBe(now1 + 0);
      expect(result.maxWaitUntil).toBe(now1 + ((10 - 5) / 5));

      const latest = bucket.latestState();
      expect(latest.availableBurst).toBe(0);
      expect(latest.now).toBe(1001);
    });
  });

  describe('when there is at least one waiter', () => {
    test('succeeds with `0` on a zero-minimum request', async () => {
      const now    = 226000;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 13, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

      // Setup / baseline assumptions.
      const requestResult = bucket.requestGrant(1300);
      await timers.setImmediate();
      expect(PromiseState.isPending(requestResult)).toBeTrue();

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 0, maxInclusive: 26 });
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(0);
      expect(result.minWaitUntil).toBe(now + 0);
      expect(result.maxWaitUntil).toBe(now + ((1300 + 26) / 13));

      time._end();
    });

    test('fails on a nonzero-minimum request', async () => {
      const now    = 51515;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 7, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

      // Setup / baseline assumptions.
      const requestResult = bucket.requestGrant(70);
      await timers.setImmediate();
      expect(PromiseState.isPending(requestResult)).toBeTrue();

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 700, maxInclusive: 1400 });
      expect(result.done).toBeFalse();
      expect(result.grant).toBe(0);
      expect(result.minWaitUntil).toBe(now + ((70 + 700) / 7));
      expect(result.maxWaitUntil).toBe(now + ((70 + 1400) / 7));

      time._end();
    });

    describe('when `partialTokens === false`', () => {
      test('will not grant a partial token even if otherwise available', () => {
        // TODO
      });
    });

    describe('when `partialTokens === true`', () => {
      test('can actually grant a partial token', () => {
        // TODO
      });
    });
  });

  describe('when there _was_ at least one waiter, but now there are none', () => {
    test('succeeds when there is sufficient available burst', async () => {
      const now    = 1000;
      const time   = new MockTimeSource(now);
      const bucket = new TokenBucket({
        flowRate: 1, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

      // Setup / baseline expectations.
      const requestResult = bucket.requestGrant(1);
      expect(PromiseState.isPending(requestResult)).toBeTrue();
      expect(bucket.latestState().waiters).toBe(1);
      const now1 = now + 3;
      time._setTime(now1);
      await timers.setImmediate();
      expect(PromiseState.isFulfilled(requestResult)).toBeTrue();
      expect(bucket.latestState().waiters).toBe(0);
      expect(bucket.latestState().availableBurst).toBe(2);

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 0, maxInclusive: 5 });
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(2);
      expect(result.minWaitUntil).toBe(now1 + 0);
      expect(result.maxWaitUntil).toBe(now1 + 3);

      time._end();
    });
  });
});
