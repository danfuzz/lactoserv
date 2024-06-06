// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { RequestRateLimiter } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '1 req/sec',
      maxBurst: '10 req'
    })).not.toThrow();
  });

  test('accepts a valid configuration with non-null `initialBurst`', () => {
    expect(() => new RequestRateLimiter({
      flowRate:     '1000 request/min',
      maxBurst:     '5 request',
      initialBurst: '2 request'
    })).not.toThrow();
  });

  test('accepts a valid configuration with `initialBurst === null`', () => {
    expect(() => new RequestRateLimiter({
      flowRate:     '1000 request/min',
      maxBurst:     '5 request',
      initialBurst: null
    })).not.toThrow();
  });

  test('accepts a valid configuration with `maxQueue`', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '1000 request/min',
      maxBurst: '5 request',
      maxQueue: '100 request'
    })).not.toThrow();
  });

  test('throws given use of `maxQueueGrant`', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '1 req/sec',
      maxBurst: '10 req',
      maxQueueGrant: '100 req'
    })).toThrow();
  });

  test('throws if given an unparseable `flowRate`', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '100_florp/splat',
      maxBurst: '10 req'
    })).toThrow();
  });

  test('throws if given an unparseable `initialBurst`', () => {
    expect(() => new RequestRateLimiter({
      flowRate:     '1 req/sec',
      maxBurst:     '10 req',
      initialBurst: 'blorp!'
    })).toThrow();
  });

  test('throws if given an unparseable `maxBurst`', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '1 req/sec',
      maxBurst: 'zonk!'
    })).toThrow();
  });

  test('throws if given `maxBurst === null`', () => {
    expect(() => new RequestRateLimiter({
      flowRate: '1 req/sec',
      maxBurst: null
    })).toThrow();
  });
});
