// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse } from '@this/net-util';


describe('constructor()', () => {
  function expectEmpty(result) {
    expect(result.cacheControl).toBeNull();
    expect(result.status).toBeNull();
    expect(result._testing_getBody()).toBeNull();
    expect([...result.headers.keys()]).toEqual([]);
  }

  test('produces an empty instance given no argument', () => {
    expectEmpty(new FullResponse());
  });

  test('produces an empty instance given `null`', () => {
    expectEmpty(new FullResponse(null));
  });

  test('produces an empty instance given an instance that itself is empty', () => {
    expectEmpty(new FullResponse(new FullResponse()));
  });

  test('produces an instance equivalent to a given non-empty one', () => {
    const orig = new FullResponse();
    orig.status       = 123;
    orig.cacheControl = 'foo=bar';
    orig.headers.append('beep', 'boop');
    orig.setBodyBuffer(Buffer.from('florp'));

    const got = new FullResponse(orig);
    expect(got.status).toBe(orig.status);
    expect(got.cacheControl).toBe(orig.cacheControl);
    expect(got.headers).not.toBe(orig.headers); // It should be a copy.
    expect([...got.headers.entries()]).toEqual([...orig.headers.entries()]);
    expect(got.bodyBuffer).toEqual(orig.bodyBuffer);
    expect(got._testing_getBody().buffer).toBe(orig._testing_getBody().buffer);
  });
});

describe('.bodyBuffer', () => {
  test('returns a copy of the buffer', () => {
    const resp = new FullResponse();
    const buf  = Buffer.alloc(123, 32);
    resp.setBodyBuffer(buf);

    const got = resp.bodyBuffer;
    expect(got).toBeInstanceOf(Buffer);
    expect(got).not.toBe(buf);
    expect(got).not.toBe(resp._testing_getBody().buffer);
    expect(got).toEqual(buf);
  });
});
