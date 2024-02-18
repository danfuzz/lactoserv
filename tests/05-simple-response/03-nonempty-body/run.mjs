// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/resp/one';

// Note: This test relies on the fact that the ETag for this URL is "weak,"
// which means that conditional ranges aren't allowed to match it.

const result = await requestAndCheck(
  'Unconditional',
  {
    url: theUrl
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, immutable, max-age=720',
      'content-length': '5',
      'content-type':   'text/plain; charset=utf-8',
      'etag':           /^W[/]"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    }
  });

const etag         = result.headers.get('etag');
const lastModified = result.headers.get('last-modified');

await requestAndCheck(
  'Unconditional, `HEAD` request',
  {
    method: 'head',
    url:    theUrl
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, immutable, max-age=720',
      'content-length': '5',
      'content-type':   'text/plain; charset=utf-8',
      'etag':           etag,
      'last-modified':  lastModified
    },
    body: null
  });

await requestAndCheck(
  'ETag conditional, matching',
  {
    url: theUrl,
    headers: {
      'if-none-match': etag
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges': 'bytes',
      'cache-control': 'public, immutable, max-age=720',
      'etag':          etag,
      'last-modified': lastModified
    },
    body: null
  });

await requestAndCheck(
  'ETag conditional, unmatching',
  {
    url: theUrl,
    headers: {
      'if-none-match': '"floop-bloop"'
    }
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, immutable, max-age=720',
      'content-length': '5',
      'content-type':   'text/plain; charset=utf-8',
      'etag':           etag,
      'last-modified':  lastModified
    },
    body: /./
  });

await requestAndCheck(
  'Range request, unconditional',
  {
    url: theUrl,
    headers: {
      'range': 'bytes=1-2'
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, immutable, max-age=720',
      'content-length': '2',
      'content-range':  'bytes 1-2/5',
      'content-type':   'text/plain; charset=utf-8',
      'etag':           etag,
      'last-modified':  lastModified
    }
  });
