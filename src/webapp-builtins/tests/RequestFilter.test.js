// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { RootControlContext } from '@this/compy';
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

  describe('with non-`null` `maxPathDepth`', () => {
    test('accepts a short-enough file path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 599
      });

      const req    = makeRequest('get', '/florp/flop');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('accepts a short-enough directory path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 599
      });

      const req    = makeRequest('get', '/florp/flop/');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a too-long file path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 501
      });

      const req    = makeRequest('get', '/florp/flop/oopsie');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(501);
    });

    test('filters out a too-long directory path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 501
      });

      const req    = makeRequest('get', '/florp/flop/oopsie/');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(501);
    });
  });

  describe('with non-`null` `maxPathLength`', () => {
    test('accepts a short-enough file path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = makeRequest('get', '/23456/8901/34/67890');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('accepts a short-enough directory path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = makeRequest('get', '/23456/8901/34/6789/');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a too-long file path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = makeRequest('get', '/23456/8901/34/678901');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(400);
    });

    test('filters out a too-long directory path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = makeRequest('get', '/23456/8901/34/67890/');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(400);
    });
  });

  describe('with non-`null` `maxQueryLength`', () => {
    test('accepts a short-enough query', async () => {
      const rf = await makeInstance({
        maxQueryLength:       8,
        filterResponseStatus: 420
      });

      const req    = makeRequest('get', '/beep/boop/bop/biff?abcd=ef');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a too-long query', async () => {
      const rf = await makeInstance({
        maxPathLength:        8,
        filterResponseStatus: 420
      });

      const req    = makeRequest('get', '/beep/boop/bop/biff?abcd=efg');
      const disp   = new DispatchInfo(TreePathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(420);
    });
  });
});
