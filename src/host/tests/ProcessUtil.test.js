// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';

import { ProcessUtil } from '@this/host';


describe('processExists()', () => {
  test('returns at least mostly-expected values based on a recent call to `ps`', () => {
    // `-A` == show all processes.
    // `-o pid=` == just print the PID, and omit the header.
    const psResult = spawnSync('ps', ['-A', '-o', 'pid='], { encoding: 'utf-8' }).stdout;
    const pidArr   = psResult
      .replaceAll(/^[ \n]+|[ \n]+$/g, '')
      .split(/[ \n]+/)
      .map((str) => parseInt(str));
    const pidSet   = new Set();

    let missedTrues  = 0;
    let missedFalses = 0;

    for (const pid of pidArr) {
      if (!ProcessUtil.processExists(pid)) {
        missedTrues++;
      }
      pidSet.add(pid);
    }

    let pidToTry = 1;
    for (let i = 0; i < pidSet.size; i++) {
      while (pidSet.has(pidToTry)) {
        pidToTry++;
      }
      if (ProcessUtil.processExists(pidToTry)) {
        missedFalses++;
      }
    }

    // We allow some misses because the set of processes can change between when
    // `ps` was done and when we do the calls to `processExists()`.
    const maxAllowedMisses = pidSet.size * 0.01;
    expect(missedTrues).toBeWithin(0, maxAllowedMisses + 1);
    expect(missedFalses).toBeWithin(0, maxAllowedMisses + 1);
  });

  test('throws given an invalid argument', () => {
    expect(() => ProcessUtil.processExists('florp')).toThrow();
  });
});
