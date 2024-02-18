// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/resp/no-body';

const result = await requestAndCheck(
  'Unconditional',
  {
    url: theUrl
  }, {
    status: 204,
    statusText: 'No Content',
    headers: {
      'cache-control': 'public, immutable, max-age=660',
      'etag':          /^"[-+/0-9a-zA-Z]+"$/
    },
    body: null
  });

await requestAndCheck(
  'Unconditional, HEAD request',
  {
    method: 'head',
    url:    theUrl
  }, {
    status: 204,
    statusText: 'No Content',
    headers: {
      'cache-control': 'public, immutable, max-age=660',
      'etag':          result.headers.get('etag')
    },
    body: null
  });

await requestAndCheck(
  'ETag conditional, matching',
  {
    url: theUrl,
    headers: {
      'if-none-match': result.headers.get('etag')
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'cache-control': 'public, immutable, max-age=660',
      'etag':          /^"[-+/0-9a-zA-Z]+"$/
    },
    body: null
  });

await requestAndCheck(
  'ETag conditional, unmatching',
  {
    url: theUrl,
    headers: {
      'if-none-match': '"floop-bloop"'
    }
  }, {
    status: 204,
    statusText: 'No Content',
    headers: {
      'cache-control': 'public, immutable, max-age=660',
      'etag':          result.headers.get('etag')
    },
    body: null
  });
