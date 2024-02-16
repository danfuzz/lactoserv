// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a range, and note the body.

const response1 = await fetch(theUrl);
const bodyText  = await response1.text();

// Get a `start-end` range.

console.log('## `start-end` range\n');

const response2 = await fetch(theUrl,
  {
    headers: {
      'range': 'bytes=5-27'
    }
  });

await checkResponse(response2, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': `${27 - 5 + 1}`,
    'content-range':  `bytes 5-27/${bodyText.length}`,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText.slice(5, 27 + 1)
});

// Get a `start-` range.

console.log('\n## `start-` range\n');

const response3 = await fetch(theUrl,
  {
    headers: {
      'range': 'bytes=200-'
    }
  });

await checkResponse(response3, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': `${bodyText.length - 200}`,
    'content-range':  `bytes 200-${bodyText.length - 1}/${bodyText.length}`,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText.slice(200)
});

// Get a `start-` range.

console.log('\n## `-suffix` range\n');

const response4 = await fetch(theUrl,
  {
    headers: {
      'range': 'bytes=-95'
    }
  });

await checkResponse(response4, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': '95',
    'content-range':  `bytes ${bodyText.length - 95}-${bodyText.length - 1}/${bodyText.length}`,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText.slice(bodyText.length - 95)
});

// Get a "not satisfiable" error, because the server only knows about `bytes`.

console.log('\n## Not Satisfiable 1\n');

const response5 = await fetch(theUrl,
  {
    headers: {
      'range': 'florp=10-100'
    }
  });

await checkResponse(response5, {
  status: 416,
  statusText: 'Range Not Satisfiable',
  headers: {
    'connection':     /./,
    'content-length': /./,
    'content-range':  `bytes */${bodyText.length}`,
    'content-type':   'text/plain; charset=utf-8',
    'date':           /./,
    'server':         /./
  }
});

// Get a "not satisfiable" error, because the range is inverted.

console.log('\n## Not Satisfiable 2\n');

const response6 = await fetch(theUrl,
  {
    headers: {
      'range': 'bytes=10-1'
    }
  });

await checkResponse(response6, {
  status: 416,
  statusText: 'Range Not Satisfiable',
  headers: {
    'connection':     /./,
    'content-length': /./,
    'content-range':  `bytes */${bodyText.length}`,
    'content-type':   'text/plain; charset=utf-8',
    'date':           /./,
    'server':         /./
  }
});
