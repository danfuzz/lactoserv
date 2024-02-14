// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a conditional check, and note the etag.

const response1 = await fetch(theUrl);
const etag      = response1.headers.get('etag');

// Try to get a match.

const response2 = await fetch(theUrl,
  {
    // Note: Node's `fetch()` puts in a conditional-busting `cache-control:
    // no-cache` header unless we put our own in.
    headers: {
      'cache-control': 'max-age=0',
      'if-none-match': etag
    }
  });

console.log('## Match 1\n');

await checkResponse(response2, {
  status: 304,
  statusText: 'Not Modified',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'server':         /./
  }
});

console.log('\n## Match 2\n');

// Try to get a match with one of N etags.

const response3 = await fetch(theUrl,
  {
    // Note: Node's `fetch()` puts in a conditional-busting `cache-control:
    // no-cache` header unless we put our own in.
    headers: {
      'cache-control': 'max-age=0',
      'if-none-match': `"XYZ", ${etag}, "PDQ"`
    }
  });

await checkResponse(response3, {
  status: 304,
  statusText: 'Not Modified',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'server':         /./
  }
});

console.log('\n## Miss\n');

// Try to get a miss, even though there is an etag (but it doesn't match).

const response4 = await fetch(theUrl,
  {
    headers: {
      'cache-control': 'max-age=0',
      'if-none-match': `"XYZ-${etag.slice(1, etag.length - 1)}"`
    }
  });

await checkResponse(response4, {
  status: 200,
  statusText: 'OK',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': response1.headers.get('content-length'),
    'content-type':   response1.headers.get('content-type'),
    'date':           /./,
    'last-modified':  response1.headers.get('last-modified'),
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'server':         /./
  },
  body: await response1.text()
});
