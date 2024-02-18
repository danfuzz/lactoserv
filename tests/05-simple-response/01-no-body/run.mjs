// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { requestAndCheck } from '@this/integration-testing';

const theUrl = 'https://localhost:8443/resp/no-body';

await requestAndCheck(
  'Unconditional',
  {
    url: theUrl
  }, {
    status: 204,
    statusText: 'No Content',
    headers: {
      'cache-control': 'public, immutable, max-age=660',
      'etag':          /^"[-+/0-9a-zA-Z]+"$/,
    },
    body: null
  });
