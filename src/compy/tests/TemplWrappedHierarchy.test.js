// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TemplWrappedHierarchy } from '@this/compy';
import { MockComponent } from '@this/compy/testing';


test('produces a class with the given name and superclass', () => {
  const got = TemplWrappedHierarchy('Florp', MockComponent);

  expect(got).toBeFunction();
  expect(got.name).toBe('Florp');

  const instance = new got();
  expect(instance).toBeInstanceOf(MockComponent);
});
