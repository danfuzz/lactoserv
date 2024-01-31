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
  ${'get'}  | ${304} | ${false}   | ${false}    | ${false}
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
