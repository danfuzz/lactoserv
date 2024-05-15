// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { HttpRange, HttpHeaders } from '@this/net-util';

describe('rangeInfo()', () => {
  test('returns `null` given a non-range request', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders();
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = 1000;
    const got =
      HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

    expect(got).toBeNull();
  });

  test.each`
  requestMethod
  ${'post'}
  ${'POST'}
  ${'put'}
  ${'PUT'}
  ${'delete'}
  ${'OPTIONS'}
  ${'trace'}
  ${'CONNECT'}
  ${'patch'}
  `('returns `null` given a request with `range` but method `$requestMethod` that doesn\'t do ranges', ({ requestMethod }) => {
    const requestHeaders  = new HttpHeaders({ range: 'bytes=10-500' });
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = 1000;
    const got =
      HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

    expect(got).toBeNull();
  });

  describe.each`
  requestMethod
  ${'get'}
  ${'GET'}
  ${'head'}
  ${'HEAD'}
  `('given `requestMethod === \'$requestMethod\'`', ({ requestMethod }) => {
    test('works for a valid non-conditional case, explicit length', () => {
      const requestHeaders  = new HttpHeaders({ range: 'bytes=10-500' });
      const responseHeaders = new HttpHeaders();
      const statsOrLength   = 1000;
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': 'bytes 10-500/1000'
        },
        status:       206,
        start:        10,
        end:          501,
        endInclusive: 500,
        length:       491
      });
    });

    test('works for a valid non-conditional case, explicit length (bigint)', () => {
      const requestHeaders  = new HttpHeaders({ range: 'bytes=1-4' });
      const responseHeaders = new HttpHeaders();
      const statsOrLength   = 10n;
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': 'bytes 1-4/10'
        },
        status:       206,
        start:        1,
        end:          5,
        endInclusive: 4,
        length:       4
      });
    });

    test('works for a valid non-conditional case, explicit length (stats object)', async () => {
      // A convenient known-to-exist path.
      const path  = (new URL(import.meta.url)).pathname;
      const stats = await fs.stat(path);
      const len   = stats.size;

      const requestHeaders  = new HttpHeaders({ range: 'bytes=15-39' });
      const responseHeaders = new HttpHeaders();
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, stats);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': `bytes 15-39/${len}`
        },
        status:       206,
        start:        15,
        end:          40,
        endInclusive: 39,
        length:       25
      });
    });

    test('works for a valid non-conditional case, length via response header', () => {
      const requestHeaders  = new HttpHeaders({ range: 'bytes=90-109' });
      const responseHeaders = new HttpHeaders({ 'content-length': '200' });
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': 'bytes 90-109/200'
        },
        status:       206,
        start:        90,
        end:          110,
        endInclusive: 109,
        length:       20
      });
    });
  });

  test('correctly rejects an invalid range (bad unit)', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ range: 'florps=10-500' });
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = 1000;
    const got =
      HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

    expect(got).toEqual({
      headers: { 'content-range': 'bytes */1000' },
      error:  true,
      status: 416
    });
  });

  test('throws if given an invalid `statsOrLength`', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ range: 'bytes=5-10' });
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = ['not', 'valid'];

    expect(() => HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength))
      .toThrow();
  });

  test('throws if given `statsOrLength === null` and there is no `content-length` header', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ range: 'bytes=5-10' });
    const responseHeaders = new HttpHeaders();
    expect(() => HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null))
      .toThrow();
  });

  test('throws if given `statsOrLength === null` and there is an unparsable `content-length` header', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ range: 'bytes=5-10' });
    const responseHeaders = new HttpHeaders({ 'content-length': 'flibbity-jibbit' });
    expect(() => HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null))
      .toThrow();
  });

  test('returns `null` given a valid case that is requesting disjoint ranges', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ range: 'bytes=1-5, 100-110' });
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = 1000;
    const got =
      HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

    expect(got).toBeNull();
  });
});

describe('setBasicResponseHeaders()', () => {
  test('sets the expected header', () => {
    const headers = new HttpHeaders();
    HttpRange.setBasicResponseHeaders(headers);

    expect([...headers.entries()]).toEqual([['accept-ranges', 'bytes']]);
  });
});
