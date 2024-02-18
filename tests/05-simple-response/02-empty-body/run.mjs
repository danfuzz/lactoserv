// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/resp/empty-body';

const result = await requestAndCheck(
  'Unconditional',
  {
    url: theUrl
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, immutable, max-age=600',
      'content-length': '0',
      'content-type':   'text/plain; charset=utf-8',
      'last-modified':  /./
    },
    body: ''
  });

const lastModified = result.headers.get('last-modified');

await requestAndCheck(
  'Date conditional, matching',
  {
    url: theUrl,
    headers: {
      'if-modified-since': lastModified
    }
  }, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'accept-ranges': 'bytes',
      'cache-control': 'public, immutable, max-age=600',
      'last-modified': lastModified
    },
    body: null
  });

const earlierDate = new Date(lastModified);
earlierDate.setSeconds(-1);

await requestAndCheck(
  'Date conditional, non-matching',
  {
    url: theUrl,
    headers: {
      'if-modified-since': earlierDate.toUTCString()
    }
  }, {
    status: 200,
    statusText: 'OK',
    headers: {
      'accept-ranges':  'bytes',
      'cache-control':  'public, immutable, max-age=600',
      'content-length': '0',
      'content-type':   'text/plain; charset=utf-8',
      'last-modified':  lastModified
    },
    body: ''
  });
