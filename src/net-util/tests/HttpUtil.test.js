// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HttpUtil } from '@this/net-util';


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

// TODO: responseBodyIsAllowedFor()
// TODO: responseBodyIsRequiredFor()
// TODO: responseIsCacheableFor()
