// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { VisitRef } from '@this/valvis';

describe('constructor()', () => {
  test('doesn\'t throw given `entry === null`', () => {
    expect(() => new VisitRef(null, 0)).not.toThrow();
  });
});

describe('.ref', () => {
  test('returns `this`', () => {
    const ref = new VisitRef(null, 1);
    expect(ref.ref).toBe(ref);
  });
});

describe('.toJSON()', () => {
  test('returns the expected replacement', () => {
    const ref = new VisitRef(null, 2);
    expect(ref.toJSON()).toStrictEqual({ '@ref': [2] });
  });
});
