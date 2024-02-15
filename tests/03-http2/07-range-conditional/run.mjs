// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a range, and note the body and salient
// headers.

const response1    = await fetch(theUrl);
const bodyText     = await response1.text();
const etag         = response1.headers.get('etag');
const lastModified = response1.headers.get('last-modified');

// Get a range which should work because the etag matches.

console.log('## Etag matches\n');

const response2 = await fetch(theUrl,
  {
    headers: {
      'range':    'bytes=10-25',
      'if-range': etag
    }
  });

await checkResponse(response2, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': `${25 - 10 + 1}`,
    'content-range':  `bytes 10-25/${bodyText.length}`,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText.slice(10, 25 + 1)
});

// Get a range which should work because the last-modified date is the same as
// the one from the original request.

console.log('\n## Last-modified matches exactly\n');

const response3 = await fetch(theUrl,
  {
    headers: {
      'range':    'bytes=20-51',
      'if-range': lastModified
    }
  });

await checkResponse(response3, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': `${51 - 20 + 1}`,
    'content-range':  `bytes 20-51/${bodyText.length}`,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText.slice(20, 51 + 1)
});

// Get a range which should work because the last-modified date is before the
// one from the original request.

console.log('\n## Last-modified is before the range date\n');

const laterDate = new Date(lastModified);
laterDate.setSeconds(laterDate.getSeconds() + 1);

const response4 = await fetch(theUrl,
  {
    headers: {
      'range':    'bytes=2-22',
      'if-range': laterDate.toUTCString()
    }
  });

await checkResponse(response4, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': `${22 - 2 + 1}`,
    'content-range':  `bytes 2-22/${bodyText.length}`,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText.slice(2, 22 + 1)
});


// Try getting a range, but expect the whole document, because the etag doesn't
// match.

console.log('\n## Etag miss\n');

const response5 = await fetch(theUrl,
  {
    headers: {
      'range':    'bytes=1-100',
      'if-range': "xyz-123"
    }
  });

await checkResponse(response5, {
  status: 200,
  statusText: 'OK',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': /./,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText
});

// Try getting a range, but expect the whole document, because the last-modified
// date is wrong.

console.log('\n## Date miss\n');

const response6 = await fetch(theUrl,
  {
    headers: {
      'range':    'bytes=1-100',
      'if-range': new Date(1234567890123).toUTCString()
    }
  });

await checkResponse(response6, {
  status: 200,
  statusText: 'OK',
  headers: {
    'accept-ranges':  'bytes',
    'cache-control':  /./,
    'connection':     /./,
    'content-length': /./,
    'content-type':   'text/html; charset=utf-8',
    'date':           /./,
    'etag':           /^"[-0-9a-zA-Z]+"$/,
    'last-modified':  /./,
    'server':         /./
  },
  body: bodyText
});
