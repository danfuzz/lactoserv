// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck, usualFetch } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a range, and note the body.

const response1 = await usualFetch({ url: theUrl });
const bodyText  = await response1.text();

// Get a `start-end` range.

await requestAndCheck(
  '`start-end` range',
  {
    url: theUrl,
    headers: {
      'range': 'bytes=5-27'
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': `${27 - 5 + 1}`,
      'content-range':  `bytes 5-27/${bodyText.length}`,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText.slice(5, 27 + 1)
  });

// Get a `start-` range.

await requestAndCheck(
  '`start-` range',
  {
    url: theUrl,
    headers: {
      'range': 'bytes=200-'
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': `${bodyText.length - 200}`,
      'content-range':  `bytes 200-${bodyText.length - 1}/${bodyText.length}`,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText.slice(200)
  });

// Get a `-suffix` range.

await requestAndCheck(
  '`-suffix` range',
  {
    url: theUrl,
    headers: {
      'range': 'bytes=-95'
    }
  }, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'content-length': '95',
      'content-range':  `bytes ${bodyText.length - 95}-${bodyText.length - 1}/${bodyText.length}`,
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /./
    },
    body: bodyText.slice(bodyText.length - 95)
  });

// Get a "not satisfiable" error, because the server only knows about `bytes`.

await requestAndCheck(
  'Not Satisfiable (wrong unit)',
  {
    url: theUrl,
    headers: {
      'range': 'florp=10-100'
    }
  }, {
    status: 416,
    statusText: 'Range Not Satisfiable',
    headers: {
      'content-length': /./,
      'content-range':  `bytes */${bodyText.length}`,
      'content-type':   'text/plain; charset=utf-8'
    }
  });

// Get a "not satisfiable" error, because the range is inverted.

await requestAndCheck(
  'Not Satisfiable (inverted range)',
  {
    url: theUrl,
    headers: {
      'range': 'bytes=10-1'
    }
  }, {
    status: 416,
    statusText: 'Range Not Satisfiable',
    headers: {
      'content-length': /./,
      'content-range':  `bytes */${bodyText.length}`,
      'content-type':   'text/plain; charset=utf-8'
    }
  });
