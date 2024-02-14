// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

const response = await fetch('https://localhost:8443/this/is/surely/not/found');

await checkResponse(response, {
  status: 404,
  statusText: 'Not Found',
  headers: {
    'cache-control':  'public, max-age=300',
    'connection':     'keep-alive',
    'content-length': /^[0-9]+$/,
    'content-type':   'text/html; charset=utf-8',
    'date':           /^[,: a-zA-Z0-9]+ GMT$/,
    'server':         /^lactoserv-[.0-9]+ [0-9a-f]+$/
  },
  body: /So sorry/
});
