// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { Duration } from '@this/data-values';
import { HttpUtil } from '@this/net-util';

describe('cacheControlHeader()', () => {
  test.each`
  arg                                            | expected
  ${{ noCache: true }}                           | ${'no-cache'}
  ${{ noStore: true }}                           | ${'no-store'}
  ${{ noCache: true, noStore: true }}            | ${'no-cache, no-store'}
  ${{ public: true }}                            | ${'public'}
  ${{ maxAge: new Duration(123) }}               | ${'max-age=123'}
  ${{ public: true, maxAge: new Duration(123) }} | ${'public, max-age=123'}
  ${{ maxAge: '123 sec' }}                       | ${'max-age=123'}
  ${{ public: true, maxAge: '123_min' }}         | ${'public, max-age=7380'}
  `('returns $expected for $arg', ({ arg, expected }) => {
    expect(HttpUtil.cacheControlHeader(arg)).toBe(expected);
  });
});

describe('classicHeaderNameFrom()', () => {
  test.each`
  arg                | expected
  ${'Cache-Control'} | ${'Cache-Control'}
  ${'cache-control'} | ${'Cache-Control'}
  ${'cacHE-COntroL'} | ${'Cache-Control'}
  ${'ETag'}          | ${'ETag'}
  ${'etag'}          | ${'ETag'}
  ${'ETAG'}          | ${'ETag'}
  ${'Beep-Boop-Bop'} | ${'Beep-Boop-Bop'} // This one should get "synthesized."
  ${'beep-boop-bop'} | ${'Beep-Boop-Bop'}
  ${'beep-BOOP-bop'} | ${'Beep-Boop-Bop'}
  `('returns $expected for $arg', ({ arg, expected }) => {
    expect(HttpUtil.classicHeaderNameFrom(arg)).toBe(expected);
  });
});

describe('dateStringFromMsec()', () => {
  // Failure cases.
  test.each`
  atMsec
  ${NaN}
  ${+Infinity}
  ${-Infinity}
  ${undefined}
  ${null}
  ${'12345'}
  ${[12345]}
  `('fails given $atMsec', ({ atMsec }) => {
    expect(() => HttpUtil.dateStringFromMsec(atMsec)).toThrow();
  });

  // Success cases.
  test.each`
  atMsec           | expected
  ${0}             | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${0.1}           | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${0.01}          | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${100}           | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${999.99}        | ${'Thu, 01 Jan 1970 00:00:00 GMT'}
  ${631155661000n} | ${'Mon, 01 Jan 1990 01:01:01 GMT'}
  ${631155661000}  | ${'Mon, 01 Jan 1990 01:01:01 GMT'}
  ${631245722000}  | ${'Tue, 02 Jan 1990 02:02:02 GMT'}
  ${631335783000}  | ${'Wed, 03 Jan 1990 03:03:03 GMT'}
  ${631425844000}  | ${'Thu, 04 Jan 1990 04:04:04 GMT'}
  ${631515905000}  | ${'Fri, 05 Jan 1990 05:05:05 GMT'}
  ${631605966000}  | ${'Sat, 06 Jan 1990 06:06:06 GMT'}
  ${631696027000}  | ${'Sun, 07 Jan 1990 07:07:07 GMT'}
  ${631786088000}  | ${'Mon, 08 Jan 1990 08:08:08 GMT'}
  ${631876149000}  | ${'Tue, 09 Jan 1990 09:09:09 GMT'}
  ${631966210000}  | ${'Wed, 10 Jan 1990 10:10:10 GMT'}
  ${632059994000}  | ${'Thu, 11 Jan 1990 12:13:14 GMT'}
  ${982873840000}  | ${'Thu, 22 Feb 2001 20:30:40 GMT'}
  ${985304085000}  | ${'Thu, 22 Mar 2001 23:34:45 GMT'}
  ${988004327000}  | ${'Mon, 23 Apr 2001 05:38:47 GMT'}
  ${991265551000}  | ${'Wed, 30 May 2001 23:32:31 GMT'}
  ${991952480000}  | ${'Thu, 07 Jun 2001 22:21:20 GMT'}
  ${994622399000}  | ${'Sun, 08 Jul 2001 19:59:59 GMT'}
  ${998113621000}  | ${'Sat, 18 Aug 2001 05:47:01 GMT'}
  ${1001652489000} | ${'Fri, 28 Sep 2001 04:48:09 GMT'}
  ${1004527353000} | ${'Wed, 31 Oct 2001 11:22:33 GMT'}
  ${1004577804000} | ${'Thu, 01 Nov 2001 01:23:24 GMT'}
  ${1007885236000} | ${'Sun, 09 Dec 2001 08:07:16 GMT'}
  `('with ($atMsec)', ({ atMsec, expected }) => {
    const result = HttpUtil.dateStringFromMsec(atMsec);
    expect(result).toBe(expected);
  });
});

describe('dateStringFromStatsMtime()', () => {
  // Failure cases.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${'/bin'}
  `('fails given $arg', ({ arg }) => {
    expect(() => HttpUtil.dateStringFromStatsMtime(arg)).toThrow();
  });

  // A convenient known-to-exist path.
  const path = (new URL(import.meta.url)).pathname;

  test('works on an instance of `fs.Stats`', async () => {
    const stats    = await fs.stat(path);
    const expected = HttpUtil.dateStringFromMsec(stats.mtimeMs);
    expect(HttpUtil.dateStringFromStatsMtime(stats)).toBe(expected);
  });

  test('works on an instance of `fs.BigIntStats`', async () => {
    const stats    = await fs.stat(path, { bigint: true });
    const expected = HttpUtil.dateStringFromMsec(stats.mtimeMs);
    expect(HttpUtil.dateStringFromStatsMtime(stats)).toBe(expected);
  });
});

describe('modernHeaderNameFrom()', () => {
  test.each`
  arg                | expected
  ${'Cache-Control'} | ${'cache-control'}
  ${'cache-control'} | ${'cache-control'}
  ${'cacHE-COntroL'} | ${'cache-control'}
  ${'ETag'}          | ${'etag'}
  ${'etag'}          | ${'etag'}
  ${'ETAG'}          | ${'etag'}
  ${'Beep-Boop-Bop'} | ${'beep-boop-bop'} // This one should get "synthesized."
  ${'beep-boop-bop'} | ${'beep-boop-bop'}
  ${'beep-BOOP-bop'} | ${'beep-boop-bop'}
  `('returns $expected for $arg', ({ arg, expected }) => {
    expect(HttpUtil.modernHeaderNameFrom(arg)).toBe(expected);
  });
});

describe('msecFromDateString()', () => {
  // Argument type errors. Expected to throw.
  test.each`
  arg
  ${undefined}
  ${true}
  ${123}
  ${['x']}
  `('throws given $arg', ({ arg }) => {
    expect(() => HttpUtil.msecFromDateString(arg)).toThrow();
  });

  test.each`
  arg                                 | expected
  ${null}                             | ${null}
  ${'who knows'}                      | ${null}
  ${'Sun, 06 Nov 1994 08:49:37 GMT'}  | ${784111777000} // The "preferred" form.
  ${'Sun, 01 Feb 2024 11:12:13 GMT'}  | ${1706785933000}
  ${'Sunday, 06-Nov-94 08:49:37 GMT'} | ${784111777000} // "Obsolete" form #1.
  ${'Sun Nov  6 08:49:37 1994'}       | ${784111777000} // "Obsolete" form #2.
  `('returns $expected for $arg', ({ arg, expected }) => {
    expect(HttpUtil.msecFromDateString(arg)).toBe(expected);
  });
});

describe.each`
methodName                     | expName
${'responseBodyIsAllowedFor'}  | ${'expAllowed'}
${'responseBodyIsRequiredFor'} | ${'expRequired'}
${'responseIsCacheableFor'}    | ${'expCache'}
`('$methodName()', ({ methodName, expName }) => {
  test.each`
  method    | status | expAllowed | expRequired | expCache
  ${'head'} | ${100} | ${false}   | ${false}    | ${false}
  ${'head'} | ${101} | ${false}   | ${false}    | ${false}
  ${'HEAD'} | ${200} | ${false}   | ${false}    | ${true}
  ${'HEAD'} | ${201} | ${false}   | ${false}    | ${false}
  ${'HEAD'} | ${202} | ${false}   | ${false}    | ${false}
  ${'HEAD'} | ${203} | ${false}   | ${false}    | ${true}
  ${'head'} | ${204} | ${false}   | ${false}    | ${true}
  ${'head'} | ${205} | ${false}   | ${false}    | ${false}
  ${'head'} | ${206} | ${false}   | ${false}    | ${true}
  ${'head'} | ${300} | ${false}   | ${false}    | ${true}
  ${'head'} | ${301} | ${false}   | ${false}    | ${true}
  ${'head'} | ${306} | ${false}   | ${false}    | ${false}
  ${'head'} | ${304} | ${false}   | ${false}    | ${true}
  ${'head'} | ${308} | ${false}   | ${false}    | ${true}
  ${'head'} | ${400} | ${true}    | ${false}    | ${false}
  ${'head'} | ${401} | ${true}    | ${false}    | ${false}
  ${'head'} | ${403} | ${true}    | ${false}    | ${false}
  ${'head'} | ${404} | ${true}    | ${false}    | ${true}
  ${'head'} | ${405} | ${true}    | ${false}    | ${true}
  ${'head'} | ${410} | ${true}    | ${false}    | ${true}
  ${'head'} | ${414} | ${true}    | ${false}    | ${true}
  ${'head'} | ${420} | ${true}    | ${false}    | ${false}
  ${'head'} | ${500} | ${true}    | ${false}    | ${false}
  ${'head'} | ${501} | ${true}    | ${false}    | ${true}
  ${'head'} | ${502} | ${true}    | ${false}    | ${false}
  ${'head'} | ${599} | ${true}    | ${false}    | ${false}

  ${'get'}  | ${100} | ${false}   | ${false}    | ${false}
  ${'get'}  | ${101} | ${false}   | ${false}    | ${false}
  ${'GET'}  | ${200} | ${true}    | ${true}     | ${true}
  ${'get'}  | ${201} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${202} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${203} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${204} | ${false}   | ${false}    | ${true}
  ${'get'}  | ${205} | ${false}   | ${false}    | ${false}
  ${'get'}  | ${206} | ${true}    | ${true}     | ${true}
  ${'get'}  | ${300} | ${true}    | ${false}    | ${true}
  ${'GET'}  | ${301} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${304} | ${false}   | ${false}    | ${true}
  ${'get'}  | ${306} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${308} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${400} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${401} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${403} | ${true}    | ${false}    | ${false}
  ${'GET'}  | ${404} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${405} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${410} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${414} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${420} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${500} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${501} | ${true}    | ${false}    | ${true}
  ${'get'}  | ${502} | ${true}    | ${false}    | ${false}
  ${'get'}  | ${599} | ${true}    | ${false}    | ${false}

  ${'post'} | ${100} | ${false}   | ${false}    | ${false}
  ${'post'} | ${101} | ${false}   | ${false}    | ${false}
  ${'post'} | ${200} | ${true}    | ${true}     | ${false}
  ${'post'} | ${201} | ${true}    | ${false}    | ${false}
  ${'POST'} | ${202} | ${true}    | ${false}    | ${false}
  ${'post'} | ${203} | ${true}    | ${false}    | ${false}
  ${'post'} | ${204} | ${false}   | ${false}    | ${false}
  ${'post'} | ${205} | ${false}   | ${false}    | ${false}
  ${'post'} | ${206} | ${true}    | ${true}     | ${false}
  ${'post'} | ${300} | ${true}    | ${false}    | ${false}
  ${'post'} | ${301} | ${true}    | ${false}    | ${false}
  ${'post'} | ${304} | ${false}   | ${false}    | ${false}
  ${'post'} | ${306} | ${true}    | ${false}    | ${false}
  ${'POST'} | ${308} | ${true}    | ${false}    | ${false}
  ${'post'} | ${400} | ${true}    | ${false}    | ${false}
  ${'post'} | ${401} | ${true}    | ${false}    | ${false}
  ${'post'} | ${403} | ${true}    | ${false}    | ${false}
  ${'post'} | ${404} | ${true}    | ${false}    | ${false}
  ${'post'} | ${405} | ${true}    | ${false}    | ${false}
  ${'post'} | ${410} | ${true}    | ${false}    | ${false}
  ${'post'} | ${414} | ${true}    | ${false}    | ${false}
  ${'post'} | ${420} | ${true}    | ${false}    | ${false}
  ${'post'} | ${500} | ${true}    | ${false}    | ${false}
  ${'post'} | ${501} | ${true}    | ${false}    | ${false}
  ${'post'} | ${502} | ${true}    | ${false}    | ${false}
  ${'post'} | ${599} | ${true}    | ${false}    | ${false}
  `('works for ($method, $status)', (args) => {
    const { method, status } = args;
    const expected = args[expName];
    expect(HttpUtil[methodName](method, status)).toBe(expected);
  });
});

describe('responseBodyIsApplicationContentFor()', () => {
  test.each`
  status | expected
  ${100} | ${false}
  ${101} | ${false}
  ${199} | ${false}
  ${200} | ${true}
  ${204} | ${true}
  ${299} | ${true}
  ${300} | ${true}
  ${301} | ${false}
  ${302} | ${false}
  ${303} | ${false}
  ${304} | ${true}
  ${305} | ${false}
  ${399} | ${false}
  ${400} | ${false}
  ${499} | ${false}
  ${500} | ${false}
  ${599} | ${false}
  `('works for ($status)', ({ status, expected }) => {
    expect(HttpUtil.responseBodyIsApplicationContentFor(status)).toBe(expected);
  });
});
