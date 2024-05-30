// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { MockRootComponent } from '@this/compy/testing';
import { DispatchInfo, StatusResponse } from '@this/net-util';
import { RequestFilter } from '@this/webapp-builtins';

import { RequestUtil } from '#test/RequestUtil';


describe('constructor', () => {
  test('accepts empty options', () => {
    expect(() => new RequestFilter({})).not.toThrow();
  });

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

    const root = new MockRootComponent();
    const rf   = new RequestFilter(opts);

    await root.start();
    await root.addAll(rf);

    return rf;
  }

  describe('with an array for `acceptMethods`', () => {
    test('accepts an allowed method', async () => {
      const rf = await makeInstance({
        acceptMethods:        ['get', 'post'],
        filterResponseStatus: 599
      });

      const req    = RequestUtil.makeRequest('post', '/florp');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a disallowed method', async () => {
      const rf = await makeInstance({
        acceptMethods:        ['post'],
        filterResponseStatus: 599
      });

      const req    = RequestUtil.makeGet('/florp');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(599);
    });
  });

  describe('with a single string for `acceptMethods`', () => {
    test('accepts an allowed method', async () => {
      const rf = await makeInstance({
        acceptMethods:        'head',
        filterResponseStatus: 599
      });

      const req    = RequestUtil.makeRequest('head', '/florp');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a disallowed method', async () => {
      const rf = await makeInstance({
        acceptMethods:        'head',
        filterResponseStatus: 599
      });

      const req    = RequestUtil.makeGet('/florp');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
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

      const req    = RequestUtil.makeGet('/florp/flop');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('accepts a short-enough directory path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 599
      });

      const req    = RequestUtil.makeGet('/florp/flop/');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a too-long file path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 501
      });

      const req    = RequestUtil.makeGet('/florp/flop/oopsie');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(501);
    });

    test('filters out a too-long directory path', async () => {
      const rf = await makeInstance({
        maxPathDepth:         2,
        filterResponseStatus: 501
      });

      const req    = RequestUtil.makeGet('/florp/flop/oopsie/');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
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

      const req    = RequestUtil.makeGet('/23456/8901/34/67890');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('accepts a short-enough directory path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = RequestUtil.makeGet('/23456/8901/34/6789/');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a too-long file path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = RequestUtil.makeGet('/23456/8901/34/678901');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(400);
    });

    test('filters out a too-long directory path', async () => {
      const rf = await makeInstance({
        maxPathLength:        20,
        filterResponseStatus: 400
      });

      const req    = RequestUtil.makeGet('/23456/8901/34/67890/');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
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

      const req    = RequestUtil.makeGet('/beep/boop/bop/biff?abcd=ef');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeNull();
    });

    test('filters out a too-long query', async () => {
      const rf = await makeInstance({
        maxPathLength:        8,
        filterResponseStatus: 420
      });

      const req    = RequestUtil.makeGet('/beep/boop/bop/biff?abcd=efg');
      const disp   = new DispatchInfo(PathKey.EMPTY, req.pathname);
      const result = await rf.handleRequest(req, disp);

      expect(result).toBeInstanceOf(StatusResponse);
      expect(result.status).toBe(420);
    });
  });
});
