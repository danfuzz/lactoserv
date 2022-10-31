// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Host, KeepRunning } from '@this/host';

import { Main } from '#x/main';


export default async function main() {
  Host.init();

  const keepRunning = new KeepRunning();
  keepRunning.run();

  const exitCode = await Main.run(process.argv);

  keepRunning.stop();

  await Host.exit(exitCode);

  // The `await` immediately above is not supposed to return.
  throw new Error('Shouldn\'t happen.');
}
