// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Main } from '#x/main';

import { KeepRunning } from '@this/host';

export default async function main() {
  const keepRunning = new KeepRunning();
  keepRunning.run();

  const exitCode = await Main.run(process.argv);

  keepRunning.stop();

  await Main.exit(exitCode);

  // The `await` above is expected never to return.
  throw new Error('Shouldn\'t happen.');
}
