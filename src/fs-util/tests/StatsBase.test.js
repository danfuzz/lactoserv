// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { StatsBase } from '@this/fs-util';


describe('StatsBase', () => {
  const path = (new URL(import.meta.url)).pathname;

  test('is a superclass of `fs.Stats`', async () => {
    const stats = await fs.stat(path);
    expect(stats instanceof StatsBase).toBeTrue();
  });

  test('is a superclass of `fs.BigIntStats`', async () => {
    const stats = await fs.stat(path, { bigint: true });
    expect(stats instanceof StatsBase).toBeTrue();
  });
});
