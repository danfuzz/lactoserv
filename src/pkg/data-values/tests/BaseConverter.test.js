// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConverter } from '@this/data-values';


describe('constructor()', () => {
  test('does not throw', () => {
    expect(() => new BaseConverter()).not.toThrow();
  });
});
