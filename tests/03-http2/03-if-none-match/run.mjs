// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck, usualFetch } from '@this/integration-testing';


const theUrl = 'https://localhost:8443/';

// First, get the response without a conditional check, and note the etag and
// body.

const response1 = await usualFetch({ url: theUrl });
const etag      = response1.headers.get('etag');
const bodyText  = await response1.text();

// Try to get a match.

await requestAndCheck(
  'Match 1',
  {
    url: theUrl,
    headers: {
      'if-none-match': etag
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'etag':           /^"[-+/0-9a-zA-Z]+"$/
    },
    body: null
  });

// Try to get a match with one of N etags.

await requestAndCheck(
  'Match 2',
  {
    url: theUrl,
    headers: {
      'if-none-match': `"XYZ", ${etag}, "PDQ"`
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'etag':           /^"[-+/0-9a-zA-Z]+"$/
    },
    body: null
  });

// Try to get a miss, even though there is an etag header (it doesn't match).

await requestAndCheck(
  'Miss 1',
  {
    url: theUrl,
    headers: {
      'if-none-match': `"XYZ-${etag.slice(1, etag.length - 1)}"`
    }
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': response1.headers.get('content-length'),
      'content-type':   response1.headers.get('content-type'),
      'last-modified':  response1.headers.get('last-modified'),
      'etag':           /^"[-+/0-9a-zA-Z]+"$/
    },
    body: bodyText
  });

// Try to get a miss, by virtue of specifying `no-cache`, even though there is
// a matching etag.

await requestAndCheck(
  'Miss 2',
  {
    url: theUrl,
    headers: {
      'cache-control': 'no-cache',
      'if-none-match': etag
    }
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': response1.headers.get('content-length'),
      'content-type':   response1.headers.get('content-type'),
      'last-modified':  response1.headers.get('last-modified'),
      'etag':           /^"[-+/0-9a-zA-Z]+"$/
    },
    body: bodyText
  });
