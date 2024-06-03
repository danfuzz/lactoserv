// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StaticFiles } from '@this/webapp-builtins';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new StaticFiles({
      siteDirectory: '/florp'
    })).not.toThrow();
  });

  test('accepts a valid full configuration', () => {
    expect(() => new StaticFiles({
      cacheControl:  { maxAge: '5 min' },
      etag:          true,
      notFoundPath:  '/blip/blop/bloop.html',
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('accepts `cacheControl: \'...\'`', () => {
    expect(() => new StaticFiles({
      cacheControl:  'max-age=1234',
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('accepts `cacheControl: {...}` with valid cache control options', () => {
    expect(() => new StaticFiles({
      cacheControl:  { public: true, sMaxAge: '1000_sec' },
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('rejects an invalid `cacheControl` option', () => {
    expect(() => new StaticFiles({
      cacheControl:  ['ummm'],
      siteDirectory: '/florp/fleep'
    })).toThrow();
  });

  test('accepts `etag: true`', () => {
    expect(() => new StaticFiles({
      etag:          true,
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('accepts `etag: {...}` with valid etag options', () => {
    expect(() => new StaticFiles({
      etag:          { hashAlgorithm: 'sha512' },
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('rejects an invalid `etag` option', () => {
    expect(() => new StaticFiles({
      etag:          ['ummm'],
      siteDirectory: '/florp/fleep'
    })).toThrow();
  });

  test('rejects a non-absolute `siteDirectory`', () => {
    expect(() => new StaticFiles({
      siteDirectory: 'florp/flop'
    })).toThrow();
  });

  test('rejects a `siteDirectory` with a trailing slash', () => {
    expect(() => new StaticFiles({
      siteDirectory: '/florp/'
    })).toThrow();
  });

  test('rejects a non-absolute `notFoundPath`', () => {
    expect(() => new StaticFiles({
      notFoundPath:  './zonk.txt',
      siteDirectory: '/florp/a/b/c'
    })).toThrow();
  });

  test('rejects a `notFoundPath` with a trailing slash', () => {
    expect(() => new StaticFiles({
      notFoundPath:  '/zonk/zip/',
      siteDirectory: '/florp/a/b/c'
    })).toThrow();
  });
});
