// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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

  test('returns `null` given a range request but with an invalid method', () => {
    const requestMethod   = 'post';
    const requestHeaders  = new HttpHeaders({ 'range': 'bytes=10-500' });
    const responseHeaders = new HttpHeaders();
    const statsOrLength   = 1000;
    const got =
      HttpRange.rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength);

    expect(got).toBeNull();
  });

  test('works for a valid non-conditional case, explicit length', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ 'range': 'bytes=10-500' });
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

  test('works for a valid non-conditional case, length via response header', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ 'range': 'bytes=90-109' });
    const responseHeaders = new HttpHeaders({ 'content-length': '200'});
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

  test('correctly rejects an invalid range (bad unit)', () => {
    const requestMethod   = 'get';
    const requestHeaders  = new HttpHeaders({ 'range': 'florps=10-500' });
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
});

describe('setBasicResponseHeaders()', () => {
  test('sets the expected header', () => {
    const headers = new HttpHeaders();
    HttpRange.setBasicResponseHeaders(headers);

    expect([...headers.entries()]).toEqual([['accept-ranges', 'bytes']]);
  });
});
