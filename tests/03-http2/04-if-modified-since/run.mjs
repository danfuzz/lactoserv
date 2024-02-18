// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck, usualFetch } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a conditional check, and note the
// last-modfied date and body.

const response1 = await usualFetch({ url: theUrl });
const lastMod   = new Date(Date.parse(response1.headers.get('last-modified')));
const bodyText  = await response1.text();

// Try to get a match.

await requestAndCheck(
  'Match 1',
  {
    url: theUrl,
    headers: {
      'if-modified-since': lastMod.toUTCString()
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'etag':           /^"[-/0-9a-zA-Z]+"$/
    },
    body: null
  });

// Try to get a match with a later date.

const laterDate = new Date(lastMod);
laterDate.setSeconds(laterDate.getSeconds() + 1);

await requestAndCheck(
  'Match 2',
  {
    url: theUrl,
    headers: {
      'if-modified-since': laterDate.toUTCString()
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'etag':           /^"[-/0-9a-zA-Z]+"$/
    },
    body: null
  });

// Try to get a miss, by virtue of passing a too-early date.

const earlierDate = new Date(lastMod);
earlierDate.setSeconds(-1);

await requestAndCheck(
  'Miss 1',
  {
    url: theUrl,
    headers: {
      'if-modified-since': earlierDate.toUTCString()
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
      'etag':           /^"[-/0-9a-zA-Z]+"$/
    },
    body: bodyText
  });

// Try to get a miss, by virtue of using `no-cache`, even though the date
// would qualify.

await requestAndCheck(
  'Miss 2',
  {
    url: theUrl,
    headers: {
      'cache-control':     'no-cache',
      'if-modified-since': lastMod.toUTCString()
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
      'etag':           /^"[-/0-9a-zA-Z]+"$/
    },
    body: bodyText
  });
