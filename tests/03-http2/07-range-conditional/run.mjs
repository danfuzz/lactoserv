// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck, usualFetch } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a range, and note the body and salient
// headers.

const response1    = await usualFetch({ url: theUrl });
const bodyText     = await response1.text();
const etag         = response1.headers.get('etag');
const lastModified = response1.headers.get('last-modified');

// Get a range which should work because the etag matches.

await requestAndCheck(
  'Etag matches',
  {
    url: theUrl,
    headers: {
      'range':    'bytes=10-25',
      'if-range': etag
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': `${25 - 10 + 1}`,
      'content-range':  `bytes 10-25/${bodyText.length}`,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText.slice(10, 25 + 1)
  });

// Get a range which should work because the last-modified date is the same as
// the one from the original request.

await requestAndCheck(
  'Last-modified matches exactly',
  {
    url: theUrl,
    headers: {
      'range':    'bytes=20-51',
      'if-range': lastModified
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': `${51 - 20 + 1}`,
      'content-range':  `bytes 20-51/${bodyText.length}`,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText.slice(20, 51 + 1)
  });

// Get a range which should work because the last-modified date is before the
// one from the original request.

const laterDate = new Date(lastModified);
laterDate.setSeconds(laterDate.getSeconds() + 1);

await requestAndCheck(
  'Last-modified is before the range date',
  {
    url: theUrl,
    headers: {
      'range':    'bytes=2-22',
      'if-range': laterDate.toUTCString()
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': `${22 - 2 + 1}`,
      'content-range':  `bytes 2-22/${bodyText.length}`,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText.slice(2, 22 + 1)
  });

// Try getting a range, but expect the whole document, because the etag doesn't
// match.

await requestAndCheck(
  'Etag miss',
  {
    url: theUrl,
    headers: {
      'range':    'bytes=1-100',
      'if-range': "xyz-123"
    }
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': /./,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText
  });

// Try getting a range, but expect the whole document, because the last-modified
// date is wrong.

await requestAndCheck(
  'Date miss',
  {
    url: theUrl,
    headers: {
      'range':    'bytes=1-100',
      'if-range': new Date(1234567890123).toUTCString()
    }
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': /./,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText
  });
