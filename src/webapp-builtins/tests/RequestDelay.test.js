// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { PromiseState } from '@this/async';
import { MockTimeSource } from '@this/clocks';
import { TreePathKey } from '@this/collections';
import { RootControlContext } from '@this/compy';
import { Duration } from '@this/data-values';
import { DispatchInfo } from '@this/net-util';
import { RequestDelay } from '@this/webapp-builtins';

import { RequestUtil } from '#test/RequestUtil';


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

  test('rejects `delay` with either `minDelay` or `maxDelay`', () => {
    expect(() => new RequestDelay({ delay: '2_sec', minDelay: '1_sec' })).toThrow();
    expect(() => new RequestDelay({ delay: '1_sec', maxDelay: '2_sec' })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  let timeSource;

  async function makeInstance(opts) {
    opts = { name: 'theOne', timeSource, ...opts };
    const rf = new RequestDelay(opts, new RootControlContext(null));
    await rf.start();

    return rf;
  }

  beforeEach(() => {
    timeSource = new MockTimeSource(10000);
  });

  test('delays by the configured `delay` amount', async () => {
    const rd = await makeInstance({ delay: '1234_sec' });

    const request = RequestUtil.makeGet('/florp');
    const result  = rd.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));

    await setImmediate();
    expect(PromiseState.isPending(result)).toBeTrue();
    timeSource._setTime(11233.999);

    await setImmediate();
    expect(PromiseState.isPending(result)).toBeTrue();
    timeSource._setTime(11234);

    await setImmediate();
    expect(PromiseState.isFulfilled(result)).toBeTrue();

    timeSource._end();
  });
});
