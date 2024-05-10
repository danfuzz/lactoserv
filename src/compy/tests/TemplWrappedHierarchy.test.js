// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MockComponent, TemplWrappedHierarchy } from '@this/compy';


test('produces a class with the given name and superclass', () => {
  const got = TemplWrappedHierarchy('Florp', MockComponent);

  expect(got).toBeFunction();
  expect(got.name).toBe('Florp');

  const instance = new got();
  expect(instance).toBeInstanceOf(MockComponent);
});
