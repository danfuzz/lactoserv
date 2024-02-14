// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a conditional check, and note the salient
// headers.

const response1 = await fetch(theUrl);
const lastMod   = new Date(Date.parse(response1.headers.get('last-modified')));
const etag      = response1.headers.get('etag');


// Try to get a match: The etag will match, but the last-modified date will
// _not_. The HTTP spec says that in this case the etag match should be the only
// thing that matters.

console.log('## Match\n');

const earlierDate = new Date(lastMod);
earlierDate.setSeconds(-1);

const response2 = await fetch(theUrl,
  {
    // Note: Node's `fetch()` puts in a conditional-busting `cache-control:
    // no-cache` header unless we put our own in.
    headers: {
      'cache-control': 'max-age=0',
      'if-modified-since': earlierDate.toUTCString(),
      'if-none-match': etag
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
