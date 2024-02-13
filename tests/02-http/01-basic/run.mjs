// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { checkResponse } from '@this/integration-testing';

async function xcheckResponse(responsePromise, config) {
  const response = await responsePromise;

  console.log('### Metadata');

  let anyErrors = false;

  if (response.status !== config.status) {
    console.log('* Status: got %s, expected %s', response.status, config.status);
    anyErrors = true;
  }

  if (response.statusText !== config.statusText) {
    console.log('* Status text: got %s, expected %s', response.statusText, config.statusText);
    anyErrors = true;
  }

  const gotHeaders = new Map(response.headers.entries());
  for (const [name, value] of Object.entries(config.headers)) {
    const got = gotHeaders.get(name);
    gotHeaders.delete(name);

    if (got === null) {
      console.log('* Header %s: missing', name);
      anyErrors = true;
    } else if (typeof value === 'string') {
      if (got !== value) {
        console.log('* Header %s: got %o, expected `%o`', name, got, value);
        anyErrors = true;
      }
    } else {
      if (!new RegExp(value).test(got)) {
        console.log('* Header %s: got `%o`, expected match of `/%o/`', name, got, value);
        anyErrors = true;
      }
    }
  }

  for (const [name, value] of Object.entries(gotHeaders)) {
    console.log('* Header %s: unexpected, value `%o`', name, value);
    anyErrors = true;
  }

  if (!anyErrors) {
    console.log('* No problems.');
  }

  console.log('');
  console.log('### Body');
  console.log('');

  if (!response.body) {
    console.log('(no body)');
  } else {
    console.log('```\n%s```', await response.text());
  }
}

const response = await fetch('http://localhost:8080/', { redirect: 'manual' });

await checkResponse(response, {
  status: 308,
  statusText: 'Permanent Redirect',
  headers: {
    'cache-control':  'public, max-age=0',
    'connection':     'keep-alive',
    'content-length': '54',
    'content-type':   'text/plain; charset=utf-8',
    'date':           /^[,: a-zA-Z0-9]+ GMT$/,
    'keep-alive':     'timeout=5',
    'location':       'https://localhost:8443/resp/',
    'server':         /^lactoserv-[.0-9]+ [0-9a-f]+$/
  }
});
