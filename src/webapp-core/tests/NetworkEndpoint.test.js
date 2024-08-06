// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { NetworkEndpoint } from '@this/webapp-core';


describe('constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new NetworkEndpoint({
      application: 'florp',
      interface:   '*:1234',
      protocol:    'http2',
      services: {
        accessLog: 'loggyLogLog'
      }
    })).not.toThrow();
  });
});
