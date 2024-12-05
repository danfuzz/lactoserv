// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EndpointAddress, HttpHeaders, IncomingRequest, InterfaceAddress,
  RequestContext }
  from '@this/net-util';


/**
 * Makes an instance with (non-pseudo) headers constructed from the given
 * argument.
 *
 * @param {*} headers Argument to pass to the {@link HttpHeaders} constructor.
 * @returns {IncomingRequest} The constructed instance.
 */
function makeWithHeaders(headers) {
  const config = {
    context: new RequestContext(
      new InterfaceAddress('127.0.0.1:123'),
      new EndpointAddress('10.0.0.1', 10321)),
    headers: new HttpHeaders(headers),
    logger: null,
    protocolName: 'http-2',
    pseudoHeaders: new HttpHeaders({
      method: 'get',
      path:   '/florp'
    })
  };

  return new IncomingRequest(config);
}

describe('constructor()', () => {
  test('accepts a smoke-testy set of arguments', () => {
    expect(() => makeWithHeaders({})).not.toThrow();
  });
});

describe('cookies', () => {
  test('parses a valid single cookie from a `cookie` header', () => {
    const req = makeWithHeaders({
      cookie: 'blorp=bleep'
    });

    expect(req.cookies.getValueOrNull('blorp')).toBe('bleep');
  });
});

describe('getHeaderOrNull', () => {
  test('finds an existing header', () => {
    const req = makeWithHeaders({
      beep: 'boop'
    });

    expect(req.getHeaderOrNull('beep')).toBe('boop');
  });

  test('returns `null` for a nonexistent header', () => {
    const req = makeWithHeaders({
      beep: 'boop'
    });

    expect(req.getHeaderOrNull('blomp')).toBeNull();
  });

  test('returns the empty array for a nonexistent `set-cookie` header', () => {
    const req = makeWithHeaders({
      beep: 'boop'
    });

    expect(req.getHeaderOrNull('set-cookie')).toEqual([]);
  });
});
