// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck, usualFetch } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/';

// First, get the response without a conditional check, and note the salient
// headers.

const response1 = await usualFetch({ url: theUrl });
const lastMod   = new Date(Date.parse(response1.headers.get('last-modified')));
const etag      = response1.headers.get('etag');


// Try to get a match: The etag will match, but the last-modified date will
// _not_. The HTTP spec says that in this case the etag match should be the only
// thing that matters.

const earlierDate = new Date(lastMod);
earlierDate.setSeconds(-1);

await requestAndCheck(
  'Match',
  {
    url: theUrl,
    headers: {
      'if-modified-since': earlierDate.toUTCString(),
      'if-none-match':     etag
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  /./,
      'connection':     /./,
      'etag':           /^"[-0-9a-zA-Z]+"$/
    }
  });
