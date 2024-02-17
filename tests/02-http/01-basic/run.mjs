// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const response = await fetch('http://localhost:8080/', { redirect: 'manual' });

await checkResponse(response, {
  status: 308,
  statusText: 'Permanent Redirect',
  headers: {
    'cache-control':  'public, max-age=300',
    'connection':     'keep-alive',
    'content-length': '54',
    'content-type':   'text/plain; charset=utf-8',
    'date':           /^[,: a-zA-Z0-9]+ GMT$/,
    'keep-alive':     'timeout=5',
    'location':       'https://localhost:8443/resp/',
    'server':         /^lactoserv-[.0-9]+ [0-9a-f]+$/
  }
});
