// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import process from 'node:process';

import { WallClock } from '@this/clocky';
import { PathKey } from '@this/collections';
import { MockRootComponent } from '@this/compy/testing';
import { DispatchInfo, FullResponse, StatusResponse } from '@this/net-util';
import { StaticFiles } from '@this/webapp-builtins';

import { RequestUtil } from '#tests/RequestUtil';


/**
 * Path to the `static-site` directory fixture.
 *
 * @type {string}
 */
const STATIC_SITE_DIR = new URL('fixtures/static-site', import.meta.url).pathname;

/**
 * Path to an existing text file within the `static-site` directory fixture.
 *
 * @type {string}
 */
const TEXT_FILE_PATH = new URL('fixtures/static-site/some-file.txt', import.meta.url).pathname;


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
      indexFile:     ['blorp.html', 'bleep.txt'],
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

  test('accepts `indexFile: null`', () => {
    expect(() => new StaticFiles({
      indexFile:     null,
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('accepts `indexFile: []`', () => {
    expect(() => new StaticFiles({
      indexFile:     null,
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('accepts `indexFile` with a single string', () => {
    expect(() => new StaticFiles({
      indexFile:     'bonk.html',
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('accepts `indexFile` with an array of strings', () => {
    expect(() => new StaticFiles({
      indexFile:     ['bonk.html', 'blorp', 'zamboni.txt'],
      siteDirectory: '/florp/fleep'
    })).not.toThrow();
  });

  test('rejects `indexFile` with a string containing a slash', () => {
    expect(() => new StaticFiles({
      indexFile:     ['x.txt', 'zip/zap.txt'],
      siteDirectory: '/florp/fleep'
    })).toThrow();

    expect(() => new StaticFiles({
      indexFile:     'beep/boop.html',
      siteDirectory: '/florp/fleep'
    })).toThrow();
  });

  test('rejects an invalid typed `indexFile`', () => {
    expect(() => new StaticFiles({
      indexFile:     { eep: 'oop'},
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

describe('_impl_handleRequest()', () => {
  async function makeInstance(config = {}) {
    const root = new MockRootComponent();
    const sf   = new StaticFiles({
      siteDirectory: STATIC_SITE_DIR,
      ...config
    });

    await root.start();
    await root.addAll(sf);

    return sf;
  }

  test.each`
  uriPath                            | filePath
  ${'/'}                             | ${'index.html'}
  ${'/index.html'}                   | ${'index.html'}
  ${'/subdir1/'}                     | ${'subdir1/index.html'}
  ${'/subdir1/index.html'}           | ${'subdir1/index.html'}
  ${'/subdir1/some-subdir-file.txt'} | ${'subdir1/some-subdir-file.txt'}
  ${'/subdir2/more-text.txt'}        | ${'subdir2/more-text.txt'}
  `('given URI path `$uriPath`, returns file path `$filePath`', async ({ uriPath, filePath }) => {
    const sf      = await makeInstance();
    const request = RequestUtil.makeGet(uriPath);
    const result  = await sf.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    expect(result).toBeInstanceOf(FullResponse);
    expect(result.status).toBe(200);

    const body = result._testing_getBody();
    expect(body.type).toBe('file');
    expect(body.path).toBe(`${STATIC_SITE_DIR}/${filePath}`);
  });

  describe.each`
  label        | passNfp
  ${'with'}    | ${true}
  ${'without'} | ${false}
  `('$label `notFoundPath`', ({ passNfp }) => {
    test.each`
    uriPath
    ${'/boop'}
    ${'/boop/florp.html'}
    ${'/subdir1/zonk.txt'}
    ${'/subdir1/zip/zonk.txt'}
    ${'/subdir1/some-subdir-file.txt/'} // No slash allowed at end of file path.
    ${'/subdir2/'} // There's no index.html in this directory.
    // Empty components should cause it to not-find.
    ${'//some-file.txt'}
    ${'//subdir1/'}
    ${'//subdir1/index.html'}
    ${'/subdir1//'}
    ${'/subdir1//some-subdir-file.txt'}
    // Invalid URI-encodings.
    ${'/subdir2%2Fmore-text.txt'} // Encoded slash is not allowed.
    ${'/%xy'}
    `('given missing path `$uriPath`, returns the expected value', async ({ uriPath }) => {
      const sf = await makeInstance({
        notFoundPath: passNfp ? `${STATIC_SITE_DIR}/not-found.html` : null
      });

      const request = RequestUtil.makeGet(uriPath);
      const result  = await sf.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

      if (passNfp) {
        expect(result).toBeInstanceOf(FullResponse);
        expect(result.status).toBe(404);

        const body = result._testing_getBody();
        expect(body.type).toBe('buffer');
        expect(body.buffer.toString()).toMatch(/Not found/);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  // Extra tests when `notFoundPath` is used
  describe('with `notFoundPath`', () => {
    test('notices when the file at `notFoundPath` is updated', async () => {
      const notFoundPath = `${tmpdir()}/not-found-${process.pid}.txt`;
      await fs.writeFile(notFoundPath, 'original');

      const sf = await makeInstance({ notFoundPath });

      const request  = RequestUtil.makeGet('/this/is/not/found');
      const dispatch = new DispatchInfo(PathKey.EMPTY, request.pathname);

      const result1 = await sf.handleRequest(request, dispatch);
      const body1   = result1._testing_getBody();
      expect(result1.status).toBe(404);
      expect(body1.type).toBe('buffer');
      expect(body1.buffer.toString()).toMatch(/original/);

      await WallClock.waitForMsec(100); // So that `mtime` will be different.
      await fs.writeFile(notFoundPath, 'replacement');

      const result2 = await sf.handleRequest(request, dispatch);
      const body2   = result2._testing_getBody();
      expect(result2.status).toBe(404);
      expect(body2.type).toBe('buffer');
      expect(body2.buffer.toString()).toMatch(/replacement/);
    });
  });

  test.each`
  uriPath
  ${'/subdir2'}
  ${'/subdir2/sub-subdir'}
  `('redirects from `$uriPath` to the slash-suffixed version of same', async ({ uriPath }) => {
    const sf      = await makeInstance();
    const request = RequestUtil.makeGet(uriPath);
    const result  = await sf.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    expect(result).toBeInstanceOf(FullResponse);
    expect(result.status).toBe(308);

    const body = result._testing_getBody();
    expect(body.type).toBe('message');

    const expectedLoc = `${uriPath.match(/[^/]+$/)[0]}/`;
    expect(result.headers.get('location')).toBe(expectedLoc);
  });

  test('includes a `cache-control` header in responses if so configured', async () => {
    const sf      = await makeInstance({ cacheControl: 'florp=123' });
    const request = RequestUtil.makeGet('/some-file.txt');
    const result  = await sf.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    expect(result).toBeInstanceOf(FullResponse);
    expect(result.status).toBe(200);
    expect(result.cacheControl).toBe('florp=123');
  });

  test('includes an `etag` header in responses if so configured', async () => {
    const sf      = await makeInstance({ etag: true });
    const request = RequestUtil.makeGet('/some-file.txt');
    const result  = await sf.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    expect(result).toBeInstanceOf(FullResponse);
    expect(result.status).toBe(200);
    expect(result.headers.get('etag')).toMatch(/^W[/]".*"$/);
  });

  test.each`
  method
  ${'delete'}
  ${'post'}
  ${'put'}
  `('responds with status `403` when request method is $method', async ({ method }) => {
    const sf = await makeInstance();

    // The file would be found if the method were `get`.
    const request1 = RequestUtil.makeRequest(method, '/some-file.txt');
    const result1  = await sf.handleRequest(request1, new DispatchInfo(PathKey.EMPTY, request1.pathname));
    expect(result1).toBeInstanceOf(StatusResponse);
    expect(result1.status).toBe(403);

    // The file would not be found, even if the method were `get`.
    const request2 = RequestUtil.makeRequest(method, '/zonk/splat/bonk.txt');
    const result2  = await sf.handleRequest(request2, new DispatchInfo(PathKey.EMPTY, request2.pathname));
    expect(result2).toBeInstanceOf(StatusResponse);
    expect(result2.status).toBe(403);
  });
});

describe('_impl_start()', () => {
  test('accepts a `siteDirectory` that refers to an existing directory', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      siteDirectory: STATIC_SITE_DIR
    });

    await expect(root.addAll(sf)).toResolve();
  });

  test('throws given a non-existent `siteDirectory`', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      siteDirectory: '/florp/zonk'
    });

    await expect(root.addAll(sf)).toReject();
  });

  test('throws given a `siteDirectory` that is a file, not a directory', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      siteDirectory: TEXT_FILE_PATH
    });

    await expect(root.addAll(sf)).toReject();
  });

  test('accepts a `notFoundPath` that refers to an existing file', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      notFoundPath:  TEXT_FILE_PATH,
      siteDirectory: STATIC_SITE_DIR
    });

    await expect(root.addAll(sf)).toResolve();
  });

  test('throws given a non-existent `notFoundPath`', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      notFoundPath:  '/florp/zonk',
      siteDirectory: STATIC_SITE_DIR
    });

    await expect(root.addAll(sf)).toReject();
  });

  test('throws given a non-existent `notFoundPath` whose directory _does_ exist', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      notFoundPath:  `${STATIC_SITE_DIR}/what-in-the-muffin-is-happening-here.txt`,
      siteDirectory: STATIC_SITE_DIR
    });

    await expect(root.addAll(sf)).toReject();
  });

  test('throws given a `notFoundPath` that is a directory, not a file', async () => {
    const root = new MockRootComponent();
    await root.start();

    const sf = new StaticFiles({
      notFoundPath:  STATIC_SITE_DIR,
      siteDirectory: STATIC_SITE_DIR
    });

    await expect(root.addAll(sf)).toReject();
  });
});
