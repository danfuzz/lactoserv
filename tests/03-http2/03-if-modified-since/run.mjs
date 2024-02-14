// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a conditional check, and note the
// last-modfied date.

const response1 = await fetch(theUrl);
const lastMod   = new Date(Date.parse(response1.headers.get('last-modified')));


// Try to get a match.

console.log('## Match 1\n');

const response2 = await fetch(theUrl,
  {
    // Note: Node's `fetch()` puts in a conditional-busting `cache-control:
    // no-cache` header unless we put our own in.
    headers: {
      'cache-control': 'max-age=0',
      'if-modified-since': lastMod.toUTCString()
    }
  });

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

// Try to get a match with a later date.

console.log('\n## Match 2\n');

const laterDate = new Date(lastMod);
laterDate.setSeconds(laterDate.getSeconds() + 1);

const response3 = await fetch(theUrl,
  {
    // Note: Node's `fetch()` puts in a conditional-busting `cache-control:
    // no-cache` header unless we put our own in.
    headers: {
      'cache-control': 'max-age=0',
      'if-modified-since': laterDate.toUTCString()
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

// Try to get a miss.

const earlierDate = new Date(lastMod);
laterDate.setSeconds(-1);

const response4 = await fetch(theUrl,
  {
    headers: {
      'cache-control': 'max-age=0',
      'if-modified-since': laterDate.toUTCString()
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
