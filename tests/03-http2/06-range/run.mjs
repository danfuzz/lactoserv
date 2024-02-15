// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a range, and note the body.

const response1 = await fetch(theUrl);
const bodyText  = await response1.text();

// Get a `start-end` range.

console.log('## Start-end range\n');

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





// TODO






// Get a "not satisfiable" error, because the server only knows about `bytes`.

console.log('\n## Not Satisfiable 2\n');

const response_xxx = await fetch(theUrl,
  {
    headers: {
      'range': 'florp=10-100'
    }
  });

await checkResponse(response_xxx, {
  status: 416,
  statusText: 'Range Not Satisfiable',
  headers: {
    'connection':     /./,
    'content-length': '0', // This is getting added by Node at a lower level.
    'content-range':  `bytes */${bodyText.length}`,
    'date':           /./,
    'server':         /./
  }
});
