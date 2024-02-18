// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

await requestAndCheck(
  'Top index',
  {
    url: 'https://localhost:8443/'
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, max-age=300',
      'connection':     'keep-alive',
      'content-length': '637',
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-0-9a-zA-Z]+"$/,
      'last-modified':  /^[,: a-zA-Z0-9]+ GMT$/
    }
  });

await requestAndCheck(
  'Redirect from non-directory path',
  {
    url: 'https://localhost:8443/subdir'
  }, {
    status: 308,
    statusText: 'Permanent Redirect',
    headers: {
      'cache-control':  'public, max-age=300',
      'connection':     'keep-alive',
      'content-length': /./,
      'content-type':   'text/plain; charset=utf-8',
      'location':       'subdir/'
    },
    body: /^subdir[/]$/m
  });
