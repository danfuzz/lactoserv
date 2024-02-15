// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { HttpConditional, HttpHeaders } from '@this/net-util';


// Common tests for argument type errors and basic argument acceptance.
describe.each`
methodName
${'isContentFresh'}
${'isRangeApplicable'}
`('$methodName()', ({ methodName }) => {
  // Convenient stats objects.
  let statsNum;
  let statsBig;

  beforeAll(async () => {
    statsNum = await fs.stat('/');
    statsBig = await fs.stat('/', { bigint: true });
  });

  const doCall = (...args) => HttpConditional[methodName](...args);

  test('rejects non-string `requestMethod`', () => {
    expect(() => doCall(123, new HttpHeaders(), new HttpHeaders(), statsNum)).toThrow();
  });

  // TODO: Check `requestHeaders` once its type has been tightened.

  test('accepts `responseHeaders === null`', () => {
    expect(() => doCall('x', new HttpHeaders(), null, statsNum)).not.toThrow();
  });

  test('rejects incorrect `responseHeaders`', () => {
    expect(() => doCall('x', new HttpHeaders(), 1234, statsNum)).toThrow();
    expect(() => doCall('x', new HttpHeaders(), new Headers(), statsNum)).toThrow();
  });

  test('rejects incorrect `stats`', () => {
    expect(() => doCall('x', new HttpHeaders(), new HttpHeaders(), 123)).toThrow();
  });

  test('accepts `stats === null`', () => {
    expect(() => doCall('x', new HttpHeaders(), new HttpHeaders(), null)).not.toThrow();
  });

  test('accepts old-style `stats`', () => {
    expect(() => doCall('x', new HttpHeaders(), new HttpHeaders(), statsNum)).not.toThrow();
  });

  test('accepts bigint `stats`', () => {
    expect(() => doCall('x', new HttpHeaders(), new HttpHeaders(), statsBig)).not.toThrow();
  });
});

describe('isContentFresh()', () => {
  // Convenient stats objects.
  let statsNum;
  let statsBig;

  beforeAll(async () => {
    statsNum = await fs.stat('/');
    statsBig = await fs.stat('/', { bigint: true });
  });

  test.each`
  requestMethod
  ${'post'}
  ${'POST'}
  ${'put'}
  ${'PUT'}
  `('never treats request method $requestMethod as fresh', ({ requestMethod }) => {
    const reqHead = new HttpHeaders();
    const resHead = new HttpHeaders();

    reqHead.set('if-none-match', '"xyz"');
    resHead.set('etag',          '"xyz"');

    expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeFalse();
  });

  describe.each`
  requestMethod
  ${'get'}
  ${'GET'}
  ${'head'}
  ${'HEAD'}
  `('for request method $requestMethod', ({ requestMethod }) => {
    test('returns `false` for an unconditional request', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      resHead.set('etag', '"xyz"');
      resHead.set('last-modified', statsNum.mtime.toUTCString());

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeFalse();
      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead, statsNum)).toBeFalse();
      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead, statsBig)).toBeFalse();
    });

    test('returns `false` for a `no-cache` request that would otherwise match', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      reqHead.set('cache-control', 'no-cache');
      reqHead.set('if-none-match', '"xyz"');
      resHead.set('etag',          '"xyz"');

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeFalse();
    });

    test('finds a fresh etag', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      reqHead.set('if-none-match', '"xyz"');
      resHead.set('etag',          '"xyz"');

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeTrue();
    });

    test('finds a fresh etag in multiple matches', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      reqHead.set('if-none-match', '"abc", "xyz", "pdq"');
      resHead.set('etag',          '"xyz"');

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeTrue();
    });

    test('does not consider a non-matching etag to be fresh', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      reqHead.set('if-none-match', '"xyz"');
      resHead.set('etag',          '"abc"');

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeFalse();
    });

    test('finds a fresh last-modified date as a header', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime = statsNum.mtime.toUTCString();

      reqHead.set('if-modified-since', modTime);
      resHead.set('last-modified',     modTime);

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeTrue();
    });

    test('finds a fresh last-modified date via a stats', () => {
      const reqHead = new HttpHeaders();

      const modTime = statsNum.mtime.toUTCString();

      reqHead.set('if-modified-since', modTime);

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, null, statsNum)).toBeTrue();
      expect(HttpConditional.isContentFresh(requestMethod, reqHead, null, statsBig)).toBeTrue();
    });

    test('understands a later last-modified date (as a header) to make things un-fresh', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime   = statsNum.mtime.toUTCString();
      const laterTime = new Date(statsNum.mtime);
      laterTime.setSeconds(laterTime.seconds + 2);

      reqHead.set('if-modified-since', modTime);
      resHead.set('last-modified',     laterTime.toUTCString());

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeFalse();
    });

    test('understands a later last-modified date (via a stats) to make things un-fresh', async () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime    = statsNum.mtime.toUTCString();
      const laterStats = await fs.stat('/');
      laterStats.mtime.setSeconds(laterStats.mtime.getSeconds() + 1);
      laterStats.mtimeMs = laterStats.mtime.getTime();

      reqHead.set('if-modified-since', modTime);

      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead, laterStats)).toBeFalse();
    });

    test('considers only an etag when `if-none-match` is specified, even if `is-modified-since` is present', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime   = statsNum.mtime.toUTCString();
      const laterTime = new Date(statsNum.mtime);
      laterTime.setSeconds(laterTime.seconds + 2);

      reqHead.set('if-modified-since', modTime);
      resHead.set('last-modified',     laterTime.toUTCString());

      reqHead.set('if-none-match', '"xyz"');
      resHead.set('etag',          '"xyz"');
      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeTrue();

      reqHead.set('if-none-match', '"abc"');
      expect(HttpConditional.isContentFresh(requestMethod, reqHead, resHead)).toBeFalse();
    });
  });
});

describe('isRangeApplicable()', () => {
  // Convenient stats objects.
  let statsNum;
  let statsBig;

  beforeAll(async () => {
    statsNum = await fs.stat('/');
    statsBig = await fs.stat('/', { bigint: true });
  });

  test.each`
  requestMethod
  ${'post'}
  ${'POST'}
  ${'put'}
  ${'PUT'}
  `('never treats request method $requestMethod as fresh', ({ requestMethod }) => {
    const reqHead = new HttpHeaders();
    const resHead = new HttpHeaders();

    reqHead.set('if-range', '"xyz"');
    resHead.set('etag',     '"xyz"');

    expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead)).toBeFalse();
  });

  describe.each`
  requestMethod
  ${'get'}
  ${'GET'}
  ${'head'}
  ${'HEAD'}
  `('for request method $requestMethod', ({ requestMethod }) => {
    test('returns `true` for an unconditional request', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      resHead.set('etag', '"xyz"');
      resHead.set('last-modified', statsNum.mtime.toUTCString());

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead)).toBeTrue();
      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead, statsNum)).toBeTrue();
      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead, statsBig)).toBeTrue();
    });

    test('finds a fresh etag', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      reqHead.set('if-range', '"xyz"');
      resHead.set('etag',     '"xyz"');

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead)).toBeTrue();
    });

    test('does not consider a non-matching etag to be fresh', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      reqHead.set('if-range', '"xyz"');
      resHead.set('etag',     '"abc"');

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead)).toBeFalse();
    });

    test('finds a fresh last-modified date as a header', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime = statsNum.mtime.toUTCString();

      reqHead.set('if-range',      modTime);
      resHead.set('last-modified', modTime);

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead)).toBeTrue();
    });

    test('finds a fresh last-modified date via a stats', () => {
      const reqHead = new HttpHeaders();

      const modTime = statsNum.mtime.toUTCString();

      reqHead.set('if-range', modTime);

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, null, statsNum)).toBeTrue();
      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, null, statsBig)).toBeTrue();
    });

    test('understands a later last-modified date (as a header) to make things un-fresh', () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime   = statsNum.mtime.toUTCString();
      const laterTime = new Date(statsNum.mtime);
      laterTime.setSeconds(laterTime.seconds + 2);

      reqHead.set('if-range',      modTime);
      resHead.set('last-modified', laterTime.toUTCString());

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead)).toBeFalse();
    });

    test('understands a later last-modified date (via a stats) to make things un-fresh', async () => {
      const reqHead = new HttpHeaders();
      const resHead = new HttpHeaders();

      const modTime    = statsNum.mtime.toUTCString();
      const laterStats = await fs.stat('/');
      laterStats.mtime.setSeconds(laterStats.mtime.getSeconds() + 1);
      laterStats.mtimeMs = laterStats.mtime.getTime();

      reqHead.set('if-range', modTime);

      expect(HttpConditional.isRangeApplicable(requestMethod, reqHead, resHead, laterStats)).toBeFalse();
    });
  });
});
