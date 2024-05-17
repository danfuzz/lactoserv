// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingRequest, FullResponse, HttpHeaders, RequestContext,
  StatusResponse }
  from '@this/net-util';

/**
 * Constructs a request object.
 *
 * @param {string} authority The authority.
 * @param {string} path The path.
 * @returns {IncomingRequest} The request object.
 */
function makeRequest(authority, path) {
  const context = new RequestContext(
    Object.freeze({}),
    Object.freeze({ address: '10.0.0.1', port: 65432 }));

  return new IncomingRequest({
    context,
    headers:       new HttpHeaders(),
    protocolName:  'http-2',
    pseudoHeaders: new HttpHeaders({
      scheme: 'https',
      method: 'GET',
      authority,
      path
    })
  });
}

describe('constructor()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${'123'}
  ${[123]}
  ${{ a: 123 }}
  ${new Set([123])}
  99                // This and the rest are improper status numbers
  -100
  100.1
  200.1
  600
  700
  123456789e123
  `('throws given $arg', ({ arg }) => {
    expect(() => new StatusResponse(arg)).toThrow();
  });

  test.each`
  arg
  ${100}
  ${200}
  ${204}
  ${300}
  ${308}
  ${400}
  ${404}
  ${500}
  ${599}
  `('accepts $arg', ({ arg }) => {
    expect(() => new StatusResponse(arg)).not.toThrow();
  });
});

describe('.status', () => {
  test('is the argument from the constructor', () => {
    const status = 123;
    expect(new StatusResponse(status).status).toBe(status);
  });
});

describe('responseFor()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${'blort'}
  ${12345}
  ${{ urlForLog: 'https://foo.bar/' }}
  `('throws given invalid argument: $arg', ({ arg }) => {
    const sr = new StatusResponse(404);
    expect(() => sr.responseFor(arg)).toThrow();
  });

  test.each`
  status   | expectBody
  ${100}   | ${false}
  ${204}   | ${false}
  ${205}   | ${false}
  ${304}   | ${false}
  ${400}   | ${true}
  ${420}   | ${true}
  ${500}   | ${true}
  ${599}   | ${true}
  `('produces the expected simple "meta" full response for status $status', ({ status, expectBody }) => {
    const sr  = new StatusResponse(status);
    const req = makeRequest('foo.bar', '/florp/like');
    const got = sr.responseFor(req);

    expect(got).toBeInstanceOf(FullResponse);

    const body = got._testing_getBody();
    if (expectBody) {
      expect(body).toEqual({ type: 'message' });
    } else {
      expect(body).toEqual({ type: 'none' });
    }
  });

  test('produces the expected URL-bearing message for status 404', () => {
    const sr   = new StatusResponse(404);

    const req1  = makeRequest('foo.bar', '/florp/like');
    const got1  = sr.responseFor(req1);
    const body1 = got1._testing_getBody();

    expect(body1).toEqual({
      type:         'message',
      messageExtra: req1.urlForLog
    });

    const req2  = makeRequest('baz.blort', '/a/b/c/d/e.html');
    const got2  = sr.responseFor(req2);
    const body2 = got2._testing_getBody();

    expect(body2).toEqual({
      type:         'message',
      messageExtra: req2.urlForLog
    });
  });
});


//
// Static members
//

describe('.NOT_FOUND', () => {
  test('is an instance of this class', () => {
    expect(StatusResponse.NOT_FOUND).toBeInstanceOf(StatusResponse);
  });

  test('is always the same instance', () => {
    const nf1 = StatusResponse.NOT_FOUND;
    const nf2 = StatusResponse.NOT_FOUND;
    expect(nf1).toBe(nf2);
  });

  test('has `status === 404`', () => {
    expect(StatusResponse.NOT_FOUND.status).toBe(404);
  });
});

describe('fromStatus()', () => {
  test('produces an instance with the given `status`', () => {
    const status = 543;
    const got    = StatusResponse.fromStatus(status);

    expect(got.status).toBe(status);
  });

  test('interns the instances it returns', () => {
    const status1 = 123;
    const status2 = 234;
    const got1a   = StatusResponse.fromStatus(status1);
    const got2a   = StatusResponse.fromStatus(status2);
    const got1b   = StatusResponse.fromStatus(status1);
    const got2b   = StatusResponse.fromStatus(status2);

    expect(got1a.status).toBe(status1);
    expect(got2a.status).toBe(status2);

    expect(got1a).toBe(got1b);
    expect(got2a).toBe(got2b);
  });
});
