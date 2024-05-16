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

    test('works for a valid etag-conditional case (condition is satisfied)', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': '"FLORP"',
        'range':    'bytes=10-11'
      });
      const responseHeaders = new HttpHeaders({
        'content-length': '20',
        'etag':           '"FLORP"'
      });
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': 'bytes 10-11/20'
        },
        status:       206,
        start:        10,
        end:          12,
        endInclusive: 11,
        length:       2
      });
    });

    test('does not match an etag-conditional that uses a _weak_ etag', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': 'W/"FLORP"',
        'range':    'bytes=10-11'
      });
      const responseHeaders = new HttpHeaders({
        etag: 'W/"FLORP"'
      });
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, 123);

      expect(got).toBeNull();
    });

    test('does not match an etag-conditional when the response does not have an etag', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': '"FLORP"',
        'range':    'bytes=10-11'
      });
      const responseHeaders = new HttpHeaders({});
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, 123);

      expect(got).toBeNull();
    });

    test('does not match an etag-conditional when the response has a different etag', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': '"FLORP"',
        'range':    'bytes=10-11'
      });
      const responseHeaders = new HttpHeaders({
        etag: '"ZOINKS"'
      });
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, 123);

      expect(got).toBeNull();
    });

    test('works for a valid date-conditional case (condition is satisfied), where the response has a `last-modified` header', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': 'Thu, 16 May 2024 00:04:21 GMT',
        'range':    'bytes=51-60'
      });
      const responseHeaders = new HttpHeaders({
        'last-modified': 'Sun, 21 Jan 2024 06:18:17 GMT'
      });
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, 2345);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': 'bytes 51-60/2345'
        },
        status:       206,
        start:        51,
        end:          61,
        endInclusive: 60,
        length:       10
      });
    });

    test('works for a valid date-conditional case (condition is satisfied), where a stats object is available', async () => {
      // A convenient known-to-exist path.
      const path  = (new URL(import.meta.url)).pathname;
      const stats = await fs.stat(path);
      const len   = stats.size;

      const requestHeaders  = new HttpHeaders({
        'if-range': new Date(stats.mtimeMs + 1000).toUTCString(),
        'range':    'bytes=0-10'
      });
      const responseHeaders = new HttpHeaders({});

      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, stats);

      expect(got).toEqual({
        headers: {
          'accept-ranges': 'bytes',
          'content-range': `bytes 0-10/${len}`
        },
        status:       206,
        start:        0,
        end:          11,
        endInclusive: 10,
        length:       11
      });
    });

    test('does not match a date-conditional when the response has a later `last-modified`', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': 'Wed, 15 May 2024 21:20:53 GMT',
        'range':    'bytes=51-60'
      });
      const responseHeaders = new HttpHeaders({
        'last-modified': 'Wed, 15 May 2024 21:20:54 GMT'
      });
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, 2345);

      expect(got).toBeNull();
    });

    test('does not match a date-conditional when the response has no `last-modified` and no stats', () => {
      const requestHeaders  = new HttpHeaders({
        'if-range': 'Wed, 15 May 2024 21:20:53 GMT',
        'range':    'bytes=51-60'
      });
      const responseHeaders = new HttpHeaders({});
      const got =
        HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, 2345);

      expect(got).toBeNull();
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

  test('returns `null` given a valid case that is requesting disjoint ranges', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ range: 'bytes=1-5, 100-110' });
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = 1000;
    const got =
      HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

    expect(got).toBeNull();
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

  test('throws if given a non-string `requestMethod`', () => {
    const requestMethod   = 123;
    const requestHeaders  = new HttpHeaders();
    const responseHeaders = new HttpHeaders();
    expect(() => HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null))
      .toThrow();
  });

  test('throws if given a non-`HttpHeaders` `requestHeaders`', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new Headers();
    const responseHeaders = new HttpHeaders();
    expect(() => HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null))
      .toThrow();
  });

  test('throws if given a non-`HttpHeaders` `responseHeaders`', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders();
    const responseHeaders = new Headers();
    expect(() => HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, null))
      .toThrow();
  });
});

describe('setBasicResponseHeaders()', () => {
  test('sets the expected header', () => {
    const headers = new HttpHeaders();
    HttpRange.setBasicResponseHeaders(headers);

    expect([...headers.entries()]).toEqual([['accept-ranges', 'bytes']]);
  });
});
