// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HttpRange, HttpHeaders } from '@this/net-util';

describe('setBasicResponseHeaders()', () => {
  test('sets the expected header', () => {
    const headers = new HttpHeaders();
    HttpRange.setBasicResponseHeaders(headers);

    expect([...headers.entries()]).toEqual([['accept-ranges', 'bytes']]);
  });
});
