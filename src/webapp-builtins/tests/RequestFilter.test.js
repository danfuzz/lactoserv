// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { RootControlContext } from '@this/compote';
import { DispatchInfo, HttpHeaders, IncomingRequest, RequestContext,
  StatusResponse }
  from '@this/net-util';
import { RequestFilter } from '@this/webapp-builtins';


// TODO: Extract this function, which also has a variant in
// `PathRouter.test.js`.
function makeRequest(method, path) {
  return new IncomingRequest({
    context: new RequestContext(
      Object.freeze({ address: 'localhost', port: 12345 }),
      Object.freeze({ address: 'awayhost',  port: 54321 })),
    headers: new HttpHeaders({
      'some-header': 'something'
    }),
    protocolName: 'http-2',
    pseudoHeaders: new HttpHeaders({
      authority: 'your.host',
      method,
      path,
      scheme:    'https'
    })
  });
}

describe('constructor', () => {
  test('accepts an omnibus valid set of options', () => {
    const opts = {
      name:                 'myFavoriteFilter',
      acceptMethods:        ['get'],
      filterResponseStatus: 503,
      maxPathDepth:         5,
      maxPathLength:        50,
      maxQueryLength:       123,
      redirectDirectories:  true,
      redirectFiles:        false,
      rejectDirectories:    false,
      rejectFiles:          false
    };

    expect(() => new RequestFilter(opts)).not.toThrow();
  });

  test('rejects more than one of the redirect/reject options being `true`', () => {
    let opts = {
      name:                 'myFavoriteFilter',
      redirectDirectories:  true,
      redirectFiles:        true,
      rejectDirectories:    false,
      rejectFiles:          false
    };

    expect(() => new RequestFilter(opts)).toThrow();

    opts = {
      ...opts,
      redirectDirectories:  false,
      redirectFiles:        true,
      rejectDirectories:    true,
      rejectFiles:          false
    };

    expect(() => new RequestFilter(opts)).toThrow();

    opts = {
      ...opts,
      redirectDirectories:  true,
      redirectFiles:        false,
      rejectDirectories:    false,
      rejectFiles:          true
    };

    expect(() => new RequestFilter(opts)).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  async function makeInstance(opts) {
    opts = { name: 'theOne', ...opts };
    const rf = new RequestFilter(opts, new RootControlContext(null));
    await rf.start();

    return rf;
  }

  describe('with non-`null` `acceptMethods`', () => {
    test('accepts an allowed method', async () => {
      const rf = await makeInstance({
        acceptMethods:        ['get', 'post'],
        filterResponseStatus: 599
      });

      const req    = makeRequest('get', '/florp');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a disallowed method', async () => {
      const rf = await makeInstance({
        acceptMethods:        ['post'],
        filterResponseStatus: 599
      });

      const req    = makeRequest('get', '/florp');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(599);
    });
  });
});
