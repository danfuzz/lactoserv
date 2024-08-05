// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HttpHeaders, IncomingRequest, RequestContext } from '@this/net-util';

describe('constructor()', () => {
  test('accepts a smoke-testy set of arguments', () => {
    const config = {
      context: new RequestContext(
        Object.freeze({
          address: '127.0.0.1',
          port:    123
        }),
        Object.freeze({
          address: '10.0.0.1',
          port:    10321
        })),
      headers: new HttpHeaders({}),
      logger: null,
      protocolName: 'http-2',
      pseudoHeaders: new HttpHeaders({
        method: 'get',
        path:   '/florp'
      })
    };

    expect(() => new IncomingRequest(config)).not.toThrow();
  });
});
