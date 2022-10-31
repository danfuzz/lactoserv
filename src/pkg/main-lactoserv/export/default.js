// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Host, KeepRunning } from '@this/host';

import { Debugging } from '#p/Debugging';
import { MainArgs } from '#p/MainArgs';
import { UsualSystem } from '#p/UsualSystem';


export default async function main() {
  Host.init();

  const args = new MainArgs(process.argv);
  args.parse();

  const system      = new UsualSystem(args);
  const keepRunning = new KeepRunning();

  keepRunning.run();
  Debugging.handleDebugArgs(args, system);
  await system.run();

  keepRunning.stop();

  // This `await` is not ever supposed to return.
  await Host.exit();
  throw new Error('Shouldn\'t happen.');
}
