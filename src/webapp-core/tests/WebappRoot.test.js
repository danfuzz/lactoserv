// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WebappRoot } from '@this/webapp-core';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new WebappRoot({})).not.toThrow();
  });
});
