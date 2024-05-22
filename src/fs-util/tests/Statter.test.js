// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import process from 'node:process';

import { WallClock } from '@this/clocky';
import { Statter } from '@this/fs-util';

/**
 * A convenient known-to-exist file.
 *
 * @type {string}
 */
const knownFile = (new URL(import.meta.url)).pathname;

/**
 * A convenient known-to-exist directory.
 *
 * @type {string}
 */
const knownDir = (new URL('.', import.meta.url)).pathname;

/**
 * A known-to-exist socket file, because we make it in `beforeAll()`.
 *
 * @type {string}
 */
let knownSocket = null;

beforeAll(async () => {
  // This uses `nc` (a/k/a `netcat`) to create a socket file, and then just
  // kills the `nc` process, leaving the file. This seems to be the most
  // reliable cross-platform way to create a socket file, strangely enough.

  const fileName = `some-socket-${process.pid}.sock`;
  const fullPath = `${knownDir}/${fileName}`;
  const proc = spawn('nc', ['-l', '-k', '-U', fileName], {
    cwd:     knownDir,
    timeout: 300
  });

  proc.stderr.on('data', (data) => {
    console.log('(netcat-stderr) %s', data.toString());
  });

  proc.stdout.on('data', (data) => {
    console.log('(netcat-stdout) %s', data.toString());
  });

  for (;;) {
    try {
      await fs.access(fullPath);
      break;
    } catch {
      // Ignore it.
    }

    if (proc.exitCode !== null) {
      throw new Error('`nc` exited without creating socket. Alas!');
    }

    await WallClock.waitForMsec(10);
  }

  proc.kill();
  knownSocket = fullPath;
});

afterAll(async () => {
  if (knownSocket) {
    await fs.unlink(knownSocket);
  }
});

describe.each`
methodName           | expectForDir | expectForFile | expectForSocket
${'directoryExists'} | ${true}      | ${false}      | ${false}
${'fileExists'}      | ${false}     | ${true}       | ${false}
${'pathExists'}      | ${true}      | ${true}       | ${true}
${'socketExists'}    | ${false}     | ${false}      | ${true}
`('$methodName()', ({ methodName, expectForDir, expectForFile, expectForSocket }) => {
  test(`returns \`${expectForDir}\` for an existing directory`, async () => {
    const got = await Statter[methodName](knownDir);
    expect(got).toBe(expectForDir);
  });

  test(`returns \`${expectForFile}\` for an existing file`, async () => {
    const got = await Statter[methodName](knownFile);
    expect(got).toBe(expectForFile);
  });

  test(`returns \`${expectForSocket}\` for an existing Unix domain socket file`, async () => {
    const got = await Statter[methodName](knownSocket);
    expect(got).toBe(expectForSocket);
  });

  test('returns `false` for a non-existent path', async () => {
    const got = await Statter[methodName]('/florp/zonk.txt');
    expect(got).toBeFalse();
  });

  test('throws given a non-string', async () => {
    await expect(Statter[methodName](123)).toReject();
  });
});

describe('statOrNull()', () => {
  test('returns `null` for a non-existent path', async () => {
    const got = await Statter.statOrNull('/boop/beep/blorp');
    expect(got).toBeNull();
  });

  test('returns a file-result `Stats` for an existing file', async () => {
    const got = await Statter.statOrNull(knownFile);
    expect(got).not.toBeNull();
    expect(got.isFile()).toBeTrue();
  });

  test('returns a directory-result `Stats` for an existing directory', async () => {
    const got = await Statter.statOrNull(knownDir);
    expect(got).not.toBeNull();
    expect(got.isDirectory()).toBeTrue();
  });
});
