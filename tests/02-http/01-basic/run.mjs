// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

await requestAndCheck(
  'Redirect: Empty path',
  {
    url: 'http://localhost:8080/'
  }, {
    status: 308,
    statusText: 'Permanent Redirect',
    headers: {
      'cache-control':  'public, max-age=300',
      'connection':     'keep-alive',
      'content-length': '54',
      'content-type':   'text/plain; charset=utf-8',
      'date':           /^[,: a-zA-Z0-9]+ GMT$/,
      'keep-alive':     'timeout=5',
      'location':       'https://localhost:8443/resp/'
    }
  });

await requestAndCheck(
  'Redirect: Non-empty path',
  {
    url: 'http://localhost:8080/beep/boop/bop'
  }, {
    status: 308,
    statusText: 'Permanent Redirect',
    headers: {
      'cache-control':  'public, max-age=300',
      'connection':     'keep-alive',
      'content-length': /./,
      'content-type':   'text/plain; charset=utf-8',
      'date':           /^[,: a-zA-Z0-9]+ GMT$/,
      'keep-alive':     'timeout=5',
      'location':       'https://localhost:8443/resp/beep/boop/bop'
    }
  });
