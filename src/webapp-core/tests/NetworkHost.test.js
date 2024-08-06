// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { NetworkHost } from '@this/webapp-core';


describe('constructor', () => {
  test('accepts a valid minimal self-signed configuration', () => {
    expect(() => new NetworkHost({
      hostnames:  '*',
      selfSigned: true
    })).not.toThrow();
  });
});
