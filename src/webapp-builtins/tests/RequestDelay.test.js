// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { PromiseState } from '@this/async';
import { MockTimeSource } from '@this/clocky/testing';
import { PathKey } from '@this/collections';
import { MockRootComponent } from '@this/compy/testing';
import { DispatchInfo } from '@this/net-util';
import { Duration } from '@this/quant';
import { RequestDelay } from '@this/webapp-builtins';

import { RequestUtil } from '#tests/RequestUtil';


/**
 * Convert the given number to thousandths, dealing with floating point error.
 *
 * @param {number} n The number in question.
 * @returns {number} `n * 1000` but with clamping near exact thousandths.
 */
function toThousandths(n) {
  const rawResult = n * 1000;

  if (Number.isSafeInteger(rawResult)) {
    return rawResult;
  }

  const rounded = Math.round(rawResult);
  const EPSILON = 0.0000000001;

  if ((rawResult >= (rounded - EPSILON)) && (rawResult <= (rounded + EPSILON))) {
    return rounded;
  }

  return rawResult;
}

describe('constructor', () => {
  test('accepts valid `delay`', () => {
    expect(() => new RequestDelay({ name: 'x', delay: '5_sec' })).not.toThrow();
    expect(() => new RequestDelay({ name: 'x', delay: new Duration(12.34) })).not.toThrow();
  });

  test('accepts valid `minDelay` and `maxDelay`', () => {
    expect(() => new RequestDelay({
      name:     'x',
      minDelay: '1_sec',
      maxDelay: '2_sec'
    })).not.toThrow();
    expect(() => new RequestDelay({
      name:     'x',
      minDelay: new Duration(1),
      maxDelay: new Duration(2)
    })).not.toThrow();
  });

  test('rejects `maxDelay` without `minDelay`', () => {
    expect(() => new RequestDelay({ maxDelay: '1_sec' })).toThrow();
  });

  test('rejects `minDelay` without `maxDelay`', () => {
    expect(() => new RequestDelay({ minDelay: '1_sec' })).toThrow();
  });

  test('rejects `minDelay > maxDelay`', () => {
    expect(() => new RequestDelay({ minDelay: '1_sec', maxDelay: '0.99_sec' })).toThrow();
  });

  test('rejects `delay` with either `minDelay` or `maxDelay`', () => {
    expect(() => new RequestDelay({ delay: '2_sec', minDelay: '1_sec' })).toThrow();
    expect(() => new RequestDelay({ delay: '1_sec', maxDelay: '2_sec' })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  let timeSource;

  async function makeInstance(opts) {
    opts = { name: 'theOne', timeSource, ...opts };

    const root = new MockRootComponent();
    const rd   = new RequestDelay(opts);

    await root.start();
    await root.addAll(rd);

    return rd;
  }

  beforeEach(() => {
    timeSource = new MockTimeSource(10000);
  });

  test('delays by the configured `delay` amount', async () => {
    const rd      = await makeInstance({ delay: '1234_sec' });
    const request = RequestUtil.makeGet('/florp');
    const result  = rd.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    await setImmediate();
    expect(PromiseState.isPending(result)).toBeTrue();
    timeSource._setTime(11233.999);

    await setImmediate();
    expect(PromiseState.isPending(result)).toBeTrue();
    timeSource._setTime(11234);

    await setImmediate();
    expect(PromiseState.isFulfilled(result)).toBeTrue();

    await result;
    await timeSource._end();
    await rd.root.stop();
  });

  test('quantizes random delays to milliseconds', async () => {
    const rd      = await makeInstance({ minDelay: '1_sec', maxDelay: '2000_sec' });
    const request = RequestUtil.makeGet('/florp');
    const results = [];

    for (let i = 0; i < 200; i++) {
      results.push(rd.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname)));
      const dur     = timeSource._lastWaitFor().sec;
      const durMsec = toThousandths(dur);

      expect(durMsec).toBeInteger();
    }

    timeSource._advanceTime(Duration.parse('3000_sec'));
    await Promise.all(results);

    await timeSource._end();
    await rd.root.stop();
  });

  test('delays by a value in the range of the configured `minDelay..maxDelay` amounts', async () => {
    const rd      = await makeInstance({ minDelay: '20_msec', maxDelay: '50_msec' });
    const request = RequestUtil.makeGet('/florp');
    const results = [];
    const waits   = [];

    for (let i = 0; i < 400; i++) {
      const result = rd.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
      results.push(result);
      const dur     = timeSource._lastWaitFor().sec;
      const durMsec = toThousandths(dur);
      expect(durMsec >= 20).toBeTrue();
      expect(durMsec <= 90).toBeTrue();
      waits[durMsec] = true;
    }

    timeSource._advanceTime(Duration.parse('100_msec'));
    await Promise.all(results);

    await rd.root.stop();
    await timeSource._end();

    // Make sure we got all possible values in the range. We can do this
    // reasonably because we know values are msec-quantized.

    const missing = [];
    for (let i = 20; i <= 50; i++) {
      if (!waits[i]) {
        missing.push(i);
      }
    }

    expect(missing).toEqual([]);
  });
});
