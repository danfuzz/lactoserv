// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { PromiseState } from '@this/async';
import { IntfTimeSource, MockTimeSource, StdTimeSource }
  from '@this/clocky';
import { Duration, Frequency, Moment } from '@this/data-values';
import { TokenBucket } from '@this/webapp-util';


/**
 * One per second, used as a `flowRate`.
 *
 * @type {Frequency}
 */
const FLOW_1 = new Frequency(1);

/**
 * Five per second, used as a `flowRate`.
 *
 * @type {Frequency}
 */
const FLOW_5 = new Frequency(5);

/**
 * Ten per second, used as a `flowRate`.
 *
 * @type {Frequency}
 */
const FLOW_10 = new Frequency(10);

/**
 * 13 per second, used as a `flowRate`.
 *
 * @type {Frequency}
 */
const FLOW_13 = new Frequency(13);

/**
 * Tiny value, used as a `flowRate`.
 *
 * @type {Frequency}
 */
const FLOW_TINY = new Frequency(0.00001);

/**
 * Big value, used as a `flowRate`.
 *
 * @type {Frequency}
 */
const FLOW_BIG = new Frequency(321 * 1024 * 1024);

/**
 * Helper to check grant return values from `requestGrant()`.
 *
 * @param {Promise} grantPromise Promise for a grant return value object.
 * @param {object} expected Expected values.
 */
async function checkGrant(grantPromise, expected) {
  expect(grantPromise).toBeInstanceOf(Promise);

  const grant = await grantPromise;

  expect(grant).toBeObject();

  const waitTimeSec = (expected.waitTime instanceof Duration)
    ? expected.waitTime.sec
    : expected.waitTime;

  expect(grant.done).toBe(expected.done);
  expect(grant.grant).toBe(expected.grant);
  expect(grant.reason).toBe(expected.reason);
  expect(grant.waitTime).toBeInstanceOf(Duration);
  expect(grant.waitTime.sec).toBe(waitTimeSec);
}

/**
 * Helper to check grant return values from `takeNow()`.
 *
 * @param {object} grant A grant return value from `takeNow()`.
 * @param {object} expected Expected values.
 */
function checkTakeNow(grant, expected) {
  expect(grant).toBeObject();

  expect(grant.done).toBe(expected.done);
  expect(grant.grant).toBe(expected.grant);
  expect(grant.waitUntil).toBeInstanceOf(Moment);

  if (expected.waitUntil !== 'any') {
    const waitUntilSec = (expected.waitUntil instanceof Moment)
      ? expected.waitUntil.atSec
      : expected.waitUntil;

    expect(grant.waitUntil.atSec).toBe(waitUntilSec);
  }
}

describe('constructor()', () => {
  test.each`
    opts
    ${{ flowRate: FLOW_1,    maxBurstSize: 1 }}
    ${{ flowRate: FLOW_TINY, maxBurstSize: 0.01 }}
    ${{ flowRate: FLOW_BIG,  maxBurstSize: 200000 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     initialBurstSize: 0 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     initialBurstSize: 1 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 10,    initialBurstSize: 10 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 10,    initialBurstSize: 9 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueGrantSize: 0 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueGrantSize: 0.1 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueGrantSize: 1 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 100,   maxQueueGrantSize: 1 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 100,   maxQueueGrantSize: 50 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 100,   maxQueueGrantSize: 99 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueSize: 1000 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueSize: 0 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueSize: 1 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     maxQueueSize: 12.34 }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     partialTokens: false }}
    ${{ flowRate: FLOW_BIG,  maxBurstSize: 123.4, partialTokens: false }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     partialTokens: true }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     timeSource: new StdTimeSource() }}
    ${{ flowRate: FLOW_1,    maxBurstSize: 1,     timeSource: new MockTimeSource() }}
    ${{ flowRate: FLOW_1, maxBurstSize: 1, initialBurstSize: 0.5, maxQueueGrantSize: 0.5,
        maxQueueSize: 10, partialTokens: true, timeSource: new MockTimeSource() }}
  `('trivially accepts valid options: $opts', ({ opts }) => {
    expect(() => new TokenBucket(opts)).not.toThrow();
  });

  test('produces an instance with the `maxBurstSize` that was passed', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 123 });
    expect(bucket.config.maxBurstSize).toBe(123);
  });

  test('produces an instance with the `flowRate` that was passed', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_BIG, maxBurstSize: 100000 });
    expect(bucket.config.flowRate.hertz).toBe(FLOW_BIG.hertz);
  });

  test.each`
    maxQueueGrantSize | partialTokens
    ${0}              | ${true}
    ${0.1}            | ${true}
    ${1}              | ${false}
    ${200}            | ${false}
  `('produces an instance with the `maxQueueGrantSize` that was passed: $maxQueueGrantSize', ({ maxQueueGrantSize, partialTokens }) => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1000, maxQueueGrantSize, partialTokens });
    expect(bucket.config.maxQueueGrantSize).toBe(maxQueueGrantSize);
  });

  test('rounds down a fractional `maxQueueGrantSize` if `partialTokens === false`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1000,
      maxQueueGrantSize: 12.9, partialTokens: false });
    expect(bucket.config.maxQueueGrantSize).toBe(12);
  });

  test('has `maxQueueGrantSize === maxBurstSize` if not passed `maxQueueGrantSize`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 10203 });
    expect(bucket.config.maxQueueGrantSize).toBe(10203);
  });

  test.each`
    maxQueueSize
    ${null}
    ${0}
    ${1.5}
    ${10}
  `('produces an instance with the `maxQueueSize` that was passed: $maxQueueSize', ({ maxQueueSize }) => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, maxQueueSize });
    expect(bucket.config.maxQueueSize).toBe(maxQueueSize);
  });

  test('has `maxQueueSize === null` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1 });
    expect(bucket.config.maxQueueSize).toBeNull();
  });

  test.each`
    partialTokens
    ${false}
    ${true}
  `('produces an instance with the `partialTokens` that was passed: $partialTokens', ({ partialTokens }) => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, partialTokens });
    expect(bucket.config.partialTokens).toBe(partialTokens);
  });

  test('has `partialTokens === false` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1 });
    expect(bucket.config.partialTokens).toBeFalse();
  });

  test('produces an instance which uses the `timeSource` that was passed', () => {
    const ts = new MockTimeSource(321);
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, timeSource: ts });
    expect(bucket.config.timeSource).toBe(ts);
    expect(bucket.latestState().now.atSec).toBe(321);
  });

  test('produces an instance which (apparently) uses the default time source if not passed `timeSource`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1 });
    expect(bucket.config.timeSource).toBeNull();
  });

  test('produces an instance with `availableBurstSize` equal to the passed `initialBurstSize`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 100, initialBurstSize: 23 });
    expect(bucket.latestState().availableBurstSize).toBe(23);
  });

  test('has `availableBurstSize === maxBurstSize` if not passed `initialBurstSize`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 123 });
    expect(bucket.latestState().availableBurstSize).toBe(123);
  });

  test('produces an instance with `availableQueueSize === infinity` if passed `maxQueueSize === null`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 100, maxQueueSize: null });
    expect(bucket.latestState().availableQueueSize).toBe(Number.POSITIVE_INFINITY);
  });

  test('produces an instance with `availableQueueSize === infinity` if not passed `maxQueueSize`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 100 });
    expect(bucket.latestState().availableQueueSize).toBe(Number.POSITIVE_INFINITY);
  });

  test('produces an instance with `availableQueueSize === maxQueueSize` for finite `maxQueueSize`', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 100, maxQueueSize: 9876 });
    expect(bucket.latestState().availableQueueSize).toBe(9876);
  });

  test('produces an instance with no waiters', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 100 });
    expect(bucket.latestState().waiterCount).toBe(0);
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
    expect(() => new TokenBucket({ flowRate: FLOW_1 })).toThrow();
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
    expect(() => new TokenBucket({ maxBurstSize, flowRate: FLOW_1 })).toThrow();
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
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, initialBurstSize })).toThrow();
  });

  test('rejects invalid `initialBurstSize` (`> maxBurstSize`)', () => {
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, initialBurstSize: 1.01 })).toThrow();
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, initialBurstSize: 2 })).toThrow();
  });

  test.each`
    maxQueueGrantSize
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
  `('rejects invalid `maxQueueGrantSize`: $maxQueueGrantSize', ({ maxQueueGrantSize }) => {
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1000, maxQueueGrantSize })).toThrow();
  });

  test('rejects invalid `maxQueueGrantSize` (`> maxQueueSize`)', () => {
    expect(() => new TokenBucket(
      { flowRate: FLOW_1, maxBurstSize: 10, maxQueueSize: 5, maxQueueGrantSize: 6 }
    )).toThrow();
  });

  test('rejects invalid `maxQueueGrantSize` (`> maxBurstSize`)', () => {
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, maxQueueGrantSize: 1.01 })).toThrow();
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, maxQueueGrantSize: 2 })).toThrow();
  });

  test.each`
    maxQueueSize
    ${false}
    ${'123'}
    ${[123]}
    ${-1}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `maxQueueSize`: $maxQueueSize', ({ maxQueueSize }) => {
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, maxQueueSize })).toThrow();
  });

  test.each`
    partialTokens
    ${null}
    ${'true'}
    ${[false]}
    ${0}
  `('rejects invalid `partialTokens`: $partialTokens', ({ partialTokens }) => {
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, partialTokens })).toThrow();
  });

  test.each`
    timeSource
    ${null}
    ${[1, 2, 3]}
    ${new Map()}
    ${IntfTimeSource /* supposed to be an instance, not a class */}
    ${MockTimeSource /* ditto */}
  `('rejects invalid `timeSource`: $timeSource', ({ timeSource }) => {
    expect(() => new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 1, timeSource })).toThrow();
  });
});

describe('.config', () => {
  test('has exactly the expected properties', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_TINY, maxBurstSize: 100000 });
    expect(bucket.config).toContainAllKeys([
      'flowRate', 'maxBurstSize', 'maxQueueGrantSize', 'maxQueueSize',
      'partialTokens', 'timeSource'
    ]);
  });
});

describe('denyAllRequests()', () => {
  test('causes pending grant requests to in fact be denied', async () => {
    const time   = new MockTimeSource(10000);
    const bucket = new TokenBucket({
      flowRate: FLOW_1, maxBurstSize: 1000, initialBurstSize: 0, timeSource: time });

    // Setup / baseline assumptions.
    const result1 = bucket.requestGrant(1);
    const result2 = bucket.requestGrant(2);
    const result3 = bucket.requestGrant(3);
    await setImmediate();
    expect(PromiseState.isPending(result1)).toBeTrue();
    expect(PromiseState.isPending(result2)).toBeTrue();
    expect(PromiseState.isPending(result3)).toBeTrue();

    // The actual test.

    const result = bucket.denyAllRequests();
    time._setTime(10987);
    expect(PromiseState.isPending(result)).toBeTrue();
    await setImmediate();
    expect(PromiseState.isFulfilled(result)).toBeTrue();

    expect(PromiseState.isFulfilled(result1)).toBeTrue();
    expect(PromiseState.isFulfilled(result2)).toBeTrue();
    expect(PromiseState.isFulfilled(result3)).toBeTrue();

    await checkGrant(result1, { done: false, grant: 0, reason: 'stopping', waitTime: 987 });
    await checkGrant(result2, { done: false, grant: 0, reason: 'stopping', waitTime: 987 });
    await checkGrant(result3, { done: false, grant: 0, reason: 'stopping', waitTime: 987 });

    time._end();
  });
});

describe('requestGrant()', () => {
  describe('when there are no waiters', () => {
    test('synchronously grants a request that can be satisfied', async () => {
      const time   = new MockTimeSource(9001);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, initialBurstSize: 123, timeSource: time });

      const result = bucket.requestGrant(123);
      expect(bucket.latestState().availableBurstSize).toBe(0);
      expect(bucket.latestState().waiterCount).toBe(0);
      await checkGrant(result, { done: true, grant: 123, reason: 'grant', waitTime: 0 });

      time._end();
    });

    test('synchronously grants a request that can be satisfied, with `grant > maxQueueGrantSize`', async () => {
      const time   = new MockTimeSource(9002);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, maxGrantQueueSize: 10,
        initialBurstSize: 321, timeSource: time });

      const result = bucket.requestGrant(300);
      expect(bucket.latestState().availableBurstSize).toBe(21);
      expect(bucket.latestState().waiterCount).toBe(0);
      await checkGrant(result, { done: true, grant: 300, reason: 'grant', waitTime: 0 });

      time._end();
    });

    test('synchronously grants `0` tokens with `minInclusive === 0` and no available burst', async () => {
      const time   = new MockTimeSource(9003);
      const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 10000,
        initialBurstSize: 0, timeSource: time });

      const result = bucket.requestGrant({ minInclusive: 0, maxInclusive: 25 });
      expect(bucket.latestState().availableBurstSize).toBe(0);
      expect(bucket.latestState().waiterCount).toBe(0);
      await checkGrant(result, { done: true, grant: 0, reason: 'grant', waitTime: 0 });

      time._end();
    });

    test('synchronously grants non-zero tokens with `minInclusive === 0` and non-zero `maxInclusive`', async () => {
      const time   = new MockTimeSource(9004);
      const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 10000,
        initialBurstSize: 96, timeSource: time });

      const result = bucket.requestGrant({ minInclusive: 0, maxInclusive: 100 });
      expect(bucket.latestState().availableBurstSize).toBe(0);
      expect(bucket.latestState().waiterCount).toBe(0);
      await checkGrant(result, { done: true, grant: 96, reason: 'grant', waitTime: 0 });

      time._end();
    });
  });

  describe('when there are waiters', () => {
    test('synchronously grants a request with `minInclusive === 0`', async () => {
      const nowSec = 12300;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

      // Setup / basic assumptions.
      const request1 = bucket.requestGrant(10);
      expect(bucket.latestState().waiterCount).toBe(1);

      // The actual test.
      const request2 = bucket.requestGrant({ minInclusive: 0, maxInclusive: 123 });
      expect(bucket.latestState().waiterCount).toBe(1);
      await setImmediate();
      expect(PromiseState.isPending(request1)).toBeTrue();
      expect(PromiseState.isFulfilled(request2)).toBeTrue();

      await checkGrant(request2, { done: true, grant: 0, reason: 'grant', waitTime: 0 });

      // Get the bucket to quiesce.
      time._setTime(nowSec + 1000);
      await expect(request1).toResolve();

      time._end();
    });

    test('synchronously fails when `availableQueueSize === 0`', async () => {
      const nowSec = 99000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, maxQueueSize: 100,
        initialBurstSize: 0, timeSource: time });

      // Setup / basic assumptions.
      const request1 = bucket.requestGrant(100);
      expect(bucket.latestState().waiterCount).toBe(1);

      // The actual test.
      const request2 = bucket.requestGrant(1);
      expect(bucket.latestState().waiterCount).toBe(1);
      await setImmediate();
      expect(PromiseState.isFulfilled(request2)).toBeTrue();
      await checkGrant(request2, { done: false, grant: 0, reason: 'full', waitTime: 0 });

      // Get the bucket to quiesce.
      time._setTime(nowSec + 1000);
      await expect(request1).toResolve();

      time._end();
    });

    test('synchronously fails if `availableQueueSize` would drop below `0`', async () => {
      const nowSec = 89100;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, maxQueueSize: 100,
        initialBurstSize: 0, timeSource: time });

      // Setup / basic assumptions.
      const request1 = bucket.requestGrant(99);
      expect(bucket.latestState().waiterCount).toBe(1);

      // The actual test.
      const request2 = bucket.requestGrant(2);
      expect(bucket.latestState().waiterCount).toBe(1);
      await setImmediate();
      expect(PromiseState.isFulfilled(request2)).toBeTrue();
      await checkGrant(request2, { done: false, grant: 0, reason: 'full', waitTime: 0 });

      // Get the bucket to quiesce.
      time._setTime(nowSec + 1000);
      await expect(request1).toResolve();

      time._end();
    });

    test('queues up a request with `0 < maxInclusive < maxQueueGrantSize`, and ultimately grants `maxInclusive`', async () => {
      const nowSec = 777000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, maxQueueGrantSize: 100,
        initialBurstSize: 0, timeSource: time });

      const request = bucket.requestGrant({ minInclusive: 25, maxInclusive: 50 });
      expect(bucket.latestState().waiterCount).toBe(1);
      time._setTime(nowSec + 321);
      await setImmediate();
      expect(PromiseState.isFulfilled(request)).toBeTrue();
      await checkGrant(request, { done: true, grant: 50, reason: 'grant', waitTime: 321 });

      time._end();
    });

    test('queues up a request with `maxInclusive > maxQueueGrantSize`, and ultimately grants `maxQueueGrantSize`', async () => {
      const nowSec = 888000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, maxQueueGrantSize: 100,
        initialBurstSize: 0, timeSource: time });

      const request = bucket.requestGrant({ minInclusive: 50, maxInclusive: 150 });
      expect(bucket.latestState().waiterCount).toBe(1);
      time._setTime(nowSec + 90909);
      await setImmediate();
      expect(PromiseState.isFulfilled(request)).toBeTrue();
      await checkGrant(request, { done: true, grant: 100, reason: 'grant', waitTime: 90909 });

      time._end();
    });

    test('grants requests in the order they were received', async () => {
      const nowSec = 182100;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, maxQueueGrantSize: 100,
        initialBurstSize: 0, timeSource: time });

      const request1 = bucket.requestGrant(10);
      const request2 = bucket.requestGrant(20);
      const request3 = bucket.requestGrant(30);
      expect(bucket.latestState().waiterCount).toBe(3);
      expect(PromiseState.isPending(request1)).toBeTrue();
      expect(PromiseState.isPending(request2)).toBeTrue();
      expect(PromiseState.isPending(request3)).toBeTrue();

      time._setTime(nowSec + 10);
      await setImmediate();
      expect(PromiseState.isFulfilled(request1)).toBeTrue();
      expect(PromiseState.isPending(request2)).toBeTrue();
      expect(PromiseState.isPending(request3)).toBeTrue();

      time._setTime(nowSec + 10 + 20);
      await setImmediate();
      expect(PromiseState.isFulfilled(request1)).toBeTrue();
      expect(PromiseState.isFulfilled(request2)).toBeTrue();
      expect(PromiseState.isPending(request3)).toBeTrue();

      time._setTime(nowSec + 10 + 20 + 30);
      await setImmediate();
      expect(PromiseState.isFulfilled(request1)).toBeTrue();
      expect(PromiseState.isFulfilled(request2)).toBeTrue();
      expect(PromiseState.isFulfilled(request3)).toBeTrue();

      await checkGrant(request1, { done: true, grant: 10, reason: 'grant', waitTime: 10 });
      await checkGrant(request2, { done: true, grant: 20, reason: 'grant', waitTime: 10 + 20 });
      await checkGrant(request3, { done: true, grant: 30, reason: 'grant', waitTime: 10 + 20 + 30 });

      time._end();
    });
  });

  describe('when `partialTokens === false`', () => {
    test('will not grant a partial token even if otherwise available (synchronously)', async () => {
      const available = 12.34;
      const time   = new MockTimeSource(12312);
      const bucket = new TokenBucket({
        partialTokens: false, flowRate: FLOW_1, maxBurstSize: 100,
        initialBurstSize: available, timeSource: time });

      const resultPromise = bucket.requestGrant({ minInclusive: 10, maxInclusive: 20 });
      expect(bucket.latestState().availableBurstSize).toBe(available % 1);
      const result = await resultPromise;
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(Math.trunc(available));
    });

    test('will not grant a partial token even if otherwise available (asynchronously)', async () => {
      const nowSec = 900;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        partialTokens: false, flowRate: FLOW_1, maxBurstSize: 100,
        maxQueueGrantSize: 10, initialBurstSize: 0, timeSource: time });

      const resultPromise = bucket.requestGrant({ minInclusive: 1.5, maxInclusive: 2.5 });
      await setImmediate();
      expect(PromiseState.isPending(resultPromise)).toBeTrue();
      time._setTime(nowSec + 10);
      const result = await resultPromise;
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(2);

      time._end();
    });
  });

  describe('when `partialTokens === true`', () => {
    test('can actually grant a partial token synchronously', async () => {
      const available = 12.34;
      const time   = new MockTimeSource(12312);
      const bucket = new TokenBucket({
        partialTokens: true, flowRate: FLOW_1, maxBurstSize: 100,
        initialBurstSize: available, timeSource: time });

      const resultPromise = bucket.requestGrant({ minInclusive: 10, maxInclusive: 20 });
      expect(bucket.latestState().availableBurstSize).toBe(0);
      const result = await resultPromise;
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(available);
    });

    test('can actually grant a partial token asynchronously', async () => {
      const grant  = 3.21;
      const nowSec = 900;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        partialTokens: true, flowRate: FLOW_1, maxBurstSize: 100,
        maxQueueGrantSize: grant, initialBurstSize: 0, timeSource: time });

      const resultPromise = bucket.requestGrant({ minInclusive: 1, maxInclusive: 10 });
      await setImmediate();
      expect(PromiseState.isPending(resultPromise)).toBeTrue();
      time._setTime(nowSec + 10);
      const result = await resultPromise;
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(grant);

      time._end();
    });
  });
});

describe('latestState()', () => {
  test('has exactly the expected properties', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_BIG, maxBurstSize: 100000 });
    expect(bucket.latestState()).toContainAllKeys([
      'availableBurstSize', 'availableQueueSize', 'now', 'waiterCount'
    ]);
  });

  test('does not use the time source', () => {
    const time   = new MockTimeSource(900);
    const bucket = new TokenBucket({
      flowRate: FLOW_1, maxBurstSize: 10000, initialBurstSize: 100, timeSource: time });

    const baseResult = bucket.latestState();
    expect(baseResult.now.atSec).toBe(900);
    expect(baseResult.availableBurstSize).toBe(100);

    time._setTime(901);
    expect(bucket.latestState()).toStrictEqual(baseResult);

    time.now = () => { throw new Error('oy!'); };
    expect(() => bucket.latestState()).not.toThrow();

    time._end();
  });

  test('indicates a lack of waiters, before any waiting has ever happened', () => {
    const bucket = new TokenBucket({ flowRate: FLOW_1, maxBurstSize: 100000 });
    expect(bucket.latestState().waiterCount).toBe(0);
  });

  test('indicates the number of waiters and available queue size as the waiters wax and wane', async () => {
    const time   = new MockTimeSource(1000);
    const bucket = new TokenBucket({
      flowRate: FLOW_1, maxBurstSize: 10000, initialBurstSize: 0, maxQueueSize: 1000,
      timeSource: time
    });

    const result1 = bucket.requestGrant(10);
    expect(PromiseState.isPending(result1)).toBeTrue();
    expect(bucket.latestState().waiterCount).toBe(1);
    expect(bucket.latestState().availableQueueSize).toBe(1000 - 10);

    const result2 = bucket.requestGrant(15);
    expect(PromiseState.isPending(result2)).toBeTrue();
    expect(bucket.latestState().waiterCount).toBe(2);
    expect(bucket.latestState().availableQueueSize).toBe(1000 - 10 - 15);

    const result3 = bucket.requestGrant(100);
    expect(PromiseState.isPending(result3)).toBeTrue();
    expect(bucket.latestState().waiterCount).toBe(3);
    expect(bucket.latestState().availableQueueSize).toBe(1000 - 10 - 15 - 100);

    time._setTime(1025); // Enough for the first two requests to get granted.
    await setImmediate();
    expect(PromiseState.isFulfilled(result1)).toBeTrue();
    expect(PromiseState.isFulfilled(result2)).toBeTrue();
    expect(bucket.latestState().waiterCount).toBe(1);
    expect(bucket.latestState().availableQueueSize).toBe(1000 - 100);

    time._setTime(1125); // Enough for the last request to get granted.
    await setImmediate();
    expect(PromiseState.isFulfilled(result3)).toBeTrue();
    expect(bucket.latestState().waiterCount).toBe(0);
    expect(bucket.latestState().availableQueueSize).toBe(1000);

    time._end();
  });
});

describe('takeNow()', () => {
  describe('when there are no waiters', () => {
    test('succeeds given an exact token quantity and sufficient available burst', () => {
      const nowSec = 98000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, initialBurstSize: 123, timeSource: time });

      const result = bucket.takeNow(123);
      checkTakeNow(result, { done: true, grant: 123, waitUntil: nowSec });

      expect(bucket.latestState().availableBurstSize).toBe(0);

      time._end();
    });

    test('succeeds with as much as is available', () => {
      const nowSec = 43210;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_5, maxBurstSize: 10000, initialBurstSize: 100, timeSource: time });

      const result = bucket.takeNow({ minInclusive: 10, maxInclusive: 110 });
      checkTakeNow(result, { done: true, grant: 100, waitUntil: nowSec + 0 });

      expect(bucket.latestState().availableBurstSize).toBe(0);

      time._end();
    });

    test('succeeds with as much burst capacity as is available', () => {
      const nowSec = 91400;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_5, maxBurstSize: 10000, initialBurstSize: 75,
        maxQueueGrantSize: 50, timeSource: time
      });

      // Notably, this is not supposed to be clamped to `maxQueueGrantSize`,
      // because this request isn't being queued (that is, there's no
      // contention.)
      const result = bucket.takeNow({ minInclusive: 10, maxInclusive: 200 });
      checkTakeNow(result, { done: true, grant: 75, waitUntil: nowSec + 0 });

      expect(bucket.latestState().availableBurstSize).toBe(0);

      time._end();
    });

    test('uses the time source', () => {
      const nowSec = 1000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_5, maxBurstSize: 100, initialBurstSize: 0, timeSource: time });

      const now1 = nowSec + 1; // Enough for 5 tokens to become available.
      time._setTime(now1);
      const result = bucket.takeNow({ minInclusive: 0, maxInclusive: 10 });
      checkTakeNow(result, { done: true, grant: 5, waitUntil: now1 + 0 });

      const latest = bucket.latestState();
      expect(latest.availableBurstSize).toBe(0);
      expect(latest.now.atSec).toBe(1001);

      time._end();
    });

    test('fails and reports an as-if-queued `waitUntil` when there is insufficient burst capacity', () => {
      const nowSec = 1000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_5, maxBurstSize: 100, initialBurstSize: 0,
        maxQueueGrantSize: 10, timeSource: time
      });

      const result = bucket.takeNow({ minInclusive: 2, maxInclusive: 91 });
      checkTakeNow(result, { done: false, grant: 0, waitUntil: nowSec + (10/5) });
      expect(result.done).toBeFalse();
      expect(result.grant).toBe(0);
      expect(result.waitUntil.atSec).toBe(nowSec + (10 / 5));

      time._end();
    });

    test('takes `availableBurstSize` into account in failures', () => {
      const nowSec = 1000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_10, maxBurstSize: 100, initialBurstSize: 5,
        maxQueueGrantSize: 20, timeSource: time
      });

      const result = bucket.takeNow({ minInclusive: 12, maxInclusive: 31 });
      checkTakeNow(result, { done: false, grant: 0, waitUntil: nowSec + (20 - 5) / 10 });

      time._end();
    });

    describe('when `partialTokens === false`', () => {
      test.each`
        available | minInclusive | maxInclusive | expected
        ${0.2}    | ${0}         | ${10}        | ${{ done: true,  grant: 0 }}
        ${1.9}    | ${2}         | ${3}         | ${{ done: false, grant: 0 }}
        ${2.5}    | ${2}         | ${4}         | ${{ done: true,  grant: 2 }}
        ${3.1}    | ${3.1}       | ${10}        | ${{ done: false, grant: 0 }}
        ${6.1}    | ${3}         | ${5.2}       | ${{ done: true,  grant: 5 }}
      `('will not grant a partial token even if requested and "available": $minInclusive .. $maxInclusive with $available available',
        ({ available, minInclusive, maxInclusive, expected }) => {
          const nowSec = 10;
          const time   = new MockTimeSource(nowSec);
          const bucket = new TokenBucket({
            partialTokens: false, flowRate: FLOW_1, maxBurstSize: 100,
            initialBurstSize: available, timeSource: time
          });

          const result = bucket.takeNow({ minInclusive, maxInclusive });
          checkTakeNow(result, { ...expected, waitUntil: 'any' });
        });
    });

    describe('when `partialTokens === true`', () => {
      test.each`
        available | minInclusive | maxInclusive | expected
        ${0.2}    | ${0}         | ${10}        | ${0.2}
        ${10}     | ${5}         | ${7.5}       | ${7.5}
        ${10.1}   | ${1}         | ${11}        | ${10.1}
        ${9.25}   | ${9.25}      | ${90}        | ${9.25}
      `('will actually grant a partial token: $minInclusive .. $maxInclusive with $available available',
        ({ available, minInclusive, maxInclusive, expected }) => {
          const nowSec = 226000;
          const time   = new MockTimeSource(nowSec);
          const bucket = new TokenBucket({
            partialTokens: true, flowRate: FLOW_1, maxBurstSize: 100, initialBurstSize: available,
            timeSource: time
          });

          const result = bucket.takeNow({ minInclusive, maxInclusive });
          checkTakeNow(result, { done: true, grant: expected, waitUntil: nowSec });
        });
    });
  });

  describe('when there is at least one waiter', () => {
    test('succeeds with `0` on a zero-minimum request', async () => {
      const nowSec = 226000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_13, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

      // Setup / baseline assumptions.
      const requestResult = bucket.requestGrant(1300);
      await setImmediate();
      expect(PromiseState.isPending(requestResult)).toBeTrue();

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 0, maxInclusive: 26 });
      checkTakeNow(result, { done: true, grant: 0, waitUntil: nowSec + 0 });

      // Get the bucket to quiesce.
      time._setTime(nowSec + 1000);
      await expect(requestResult).toResolve();

      time._end();
    });

    test('fails on a nonzero-minimum request', async () => {
      const nowSec = 50015;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_10, maxBurstSize: 10000, initialBurstSize: 0,
        maxQueueGrantSize: 1000, timeSource: time
      });

      // Setup / baseline assumptions.
      const requestResult = bucket.requestGrant(300);
      await setImmediate();
      expect(PromiseState.isPending(requestResult)).toBeTrue();

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 700, maxInclusive: 1400 });
      checkTakeNow(result, { done: false, grant: 0, waitUntil: nowSec + ((300 + 1000) / 10) });

      // Get the bucket to quiesce.
      time._setTime(nowSec + 1000);
      await expect(requestResult).toResolve();

      time._end();
    });

    test('fails on a nonzero-minimum request, taking `availableBurstSize` into account', async () => {
      const nowSec = 60015;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_10, maxBurstSize: 10000, initialBurstSize: 200,
        maxQueueGrantSize: 1000, timeSource: time
      });

      // Setup / baseline assumptions.
      const requestResult = bucket.requestGrant(300);
      await setImmediate();
      expect(PromiseState.isPending(requestResult)).toBeTrue();

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 700, maxInclusive: 1400 });
      checkTakeNow(result, { done: false, grant: 0, waitUntil: nowSec + ((300 + 1000 - 200) / 10) });

      // Get the bucket to quiesce.
      time._setTime(nowSec + 1000);
      await expect(requestResult).toResolve();

      time._end();
    });
  });

  describe('when there _was_ at least one waiter, but now there are none', () => {
    test('succeeds when there is sufficient available burst', async () => {
      const nowSec = 1000;
      const time   = new MockTimeSource(nowSec);
      const bucket = new TokenBucket({
        flowRate: FLOW_1, maxBurstSize: 10000, initialBurstSize: 0, timeSource: time });

      // Setup / baseline expectations.
      const requestResult = bucket.requestGrant(1);
      expect(PromiseState.isPending(requestResult)).toBeTrue();
      expect(bucket.latestState().waiterCount).toBe(1);
      const now1 = nowSec + 3;
      time._setTime(now1);
      await setImmediate();
      expect(PromiseState.isFulfilled(requestResult)).toBeTrue();
      expect(bucket.latestState().waiterCount).toBe(0);
      expect(bucket.latestState().availableBurstSize).toBe(2);

      // The actual test.
      const result = bucket.takeNow({ minInclusive: 0, maxInclusive: 5 });
      checkTakeNow(result, { done: true, grant: 2, waitUntil: now1 + 0 });
      expect(result.done).toBeTrue();
      expect(result.grant).toBe(2);
      expect(result.waitUntil.atSec).toBe(now1 + 0);

      time._end();
    });
  });
});
