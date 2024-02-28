// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';


const urlBase = 'https://localhost:8443';

await requestAndCheck(
  'Top index',
  {
    url: `${urlBase}/`
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, max-age=300',
      'content-length': '677',
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /^[,: a-zA-Z0-9]+ GMT$/
    }
  });

await requestAndCheck(
  'Redirect from non-directory path',
  {
    url: `${urlBase}/subdir`
  }, {
    status: 308,
    statusText: 'Permanent Redirect',
    headers: {
      'cache-control':  'public, max-age=300',
      'content-length': /./,
      'content-type':   'text/plain; charset=utf-8',
      'location':       'subdir/'
    },
    body: /^subdir[/]$/m
  });

await requestAndCheck(
  'Subdirectory index',
  {
    url: `${urlBase}/subdir/`
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, max-age=300',
      'content-length': '108',
      'content-type':   'text/html; charset=utf-8',
      'etag':           /^"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /^[,: a-zA-Z0-9]+ GMT$/
    }
  });

await requestAndCheck(
  'Subdirectory file',
  {
    url: `${urlBase}/subdir/one.txt`
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, max-age=300',
      'content-length': '4',
      'content-type':   'text/plain; charset=utf-8',
      'etag':           /^"[-+/0-9a-zA-Z]+"$/,
      'last-modified':  /^[,: a-zA-Z0-9]+ GMT$/
    }
  });
