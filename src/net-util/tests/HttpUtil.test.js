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

describe.each`
methodName                     | expName
${'responseBodyIsAllowedFor'}  | ${'expAllowed'}
${'responseBodyIsRequiredFor'} | ${'expRequired'}
`('$methodName()', ({ methodName, expName }) => {
  test.each`
  method    | status | expAllowed | expRequired
  ${'head'} | ${100} | ${false}   | ${false}
  ${'HEAD'} | ${200} | ${false}   | ${false}
  ${'HEAD'} | ${200} | ${false}   | ${false}
  ${'head'} | ${204} | ${false}   | ${false}
  ${'head'} | ${205} | ${false}   | ${false}
  ${'head'} | ${300} | ${false}   | ${false}
  ${'head'} | ${306} | ${false}   | ${false}
  ${'head'} | ${400} | ${true}    | ${false}
  ${'head'} | ${500} | ${true}    | ${false}
  ${'head'} | ${599} | ${true}    | ${false}
  ${'get'}  | ${100} | ${false}   | ${false}
  ${'post'} | ${101} | ${false}   | ${false}
  ${'GET'}  | ${200} | ${true}    | ${true}
  ${'get'}  | ${206} | ${true}    | ${true}
  ${'POST'} | ${200} | ${true}    | ${true}
  ${'POST'} | ${206} | ${true}    | ${true}
  ${'get'}  | ${204} | ${false}   | ${false}
  ${'get'}  | ${205} | ${false}   | ${false}
  ${'get'}  | ${304} | ${false}   | ${false}
  `('works for ($method, $status)', (args) => {
    const { method, status } = args;
    const expected = args[expName];
    expect(HttpUtil[methodName](method, status)).toBe(expected);
  });
});

describe('responseIsCacheableFor()', () => {
  // TODO
});
