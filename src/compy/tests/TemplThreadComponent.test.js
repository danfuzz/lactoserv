// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MockComponent, TemplThreadComponent } from '@this/compy';


test('produces a class with the given name and superclass', () => {
  const got = TemplThreadComponent('Florp', MockComponent);

  expect(got).toBeFunction();
  expect(got.name).toBe('Florp');

  const instance = new got();
  expect(instance).toBeInstanceOf(MockComponent);
});
