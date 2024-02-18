// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

await requestAndCheck(
  'Top Index',
  {
    url: 'https://localhost:8443/'
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, max-age=300',
      'content-length': '637',
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-0-9a-zA-Z]+"$/,
      'last-modified':  /^[,: a-zA-Z0-9]+ GMT$/
    }
  });
