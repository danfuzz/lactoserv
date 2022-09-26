// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventSink, PromiseState } from '@this/async';

import * as timers from 'node:timers/promises';


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
