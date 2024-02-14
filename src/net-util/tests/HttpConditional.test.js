// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { HttpConditional, HttpHeaders } from '@this/net-util';


describe('isContentFresh()', () => {
  // Convenient stats objects.
  let statsNum;
  let statsBig;

  beforeAll(async () => {
    statsNum = await fs.stat('/');
    statsBig = await fs.stat('/', { bigint: true });
  });

  test('rejects non-string `requestMethod`', () => {
    expect(() => HttpConditional.isContentFresh(123, new HttpHeaders(), new HttpHeaders(), statsNum)).toThrow();
  });

  // TODO: Check `requestHeaders` once its type has been tightened.

  test('rejects incorrect `responseHeaders`', () => {
    expect(() => HttpConditional.isContentFresh('x', new HttpHeaders(), null, statsNum)).toThrow();
    expect(() => HttpConditional.isContentFresh('x', new HttpHeaders(), new Headers(), statsNum)).toThrow();
  });

  test('rejects incorrect `stats`', () => {
    expect(() => HttpConditional.isContentFresh('x', new HttpHeaders(), new HttpHeaders(), 123)).toThrow();
  });

  test('accepts `stats === null`', () => {
    expect(() => HttpConditional.isContentFresh('x', new HttpHeaders(), new HttpHeaders(), null)).not.toThrow();
  });

  test('accepts old-style `stats`', () => {
    expect(() => HttpConditional.isContentFresh('x', new HttpHeaders(), new HttpHeaders(), statsNum)).not.toThrow();
  });

  test('accepts bigint `stats`', () => {
    expect(() => HttpConditional.isContentFresh('x', new HttpHeaders(), new HttpHeaders(), statsBig)).not.toThrow();
  });

  // TODO
});
