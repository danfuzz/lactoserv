// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Host, KeepRunning } from '@this/host';

import { Main } from '#x/Main';
import { MainArgs } from '#p/MainArgs';


export default async function main() {
  Host.init();

  const args = new MainArgs(process.argv);
  args.parse();

  const keepRunning = new KeepRunning();
  keepRunning.run();

  const exitCode = await Main.run(args);

  keepRunning.stop();

  // This `await` is not ever supposed to return.
  await Host.exit(exitCode);
  throw new Error('Shouldn\'t happen.');
}
