// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { VisitRef } from '@this/valvis';


describe('constructor()', () => {
  test('doesn\'t throw given `entry === null`', () => {
    expect(() => new VisitRef(0, null)).not.toThrow();
  });
});

describe('.ref', () => {
  test('returns `this`', () => {
    const ref = new VisitRef(1, null);
    expect(ref.ref).toBe(ref);
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const ref = new VisitRef(2, null);
    expect(ref.toJSON()).toStrictEqual({ '@ref': [2] });
  });
});
