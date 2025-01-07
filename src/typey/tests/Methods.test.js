// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';


describe('abstract()', () => {
  for (let i = 0; i < 5; i++) {
    let label;
    switch (i) {
      case 0:  { label = 'no arguments';   break; }
      case 1:  { label = 'one argument';   break; }
      default: { label = `${i} arguments`; break; }
    }
    test(`throws given ${label}.`, () => {
      const args = new Array(i);
      args.fill('florp');

      expect(() => Methods.abstract(...args)).toThrow(/Abstract method/);
    });
  }
});
