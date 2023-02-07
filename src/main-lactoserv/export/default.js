// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Host, KeepRunning } from '@this/host';

import { Debugging } from '#p/Debugging';
import { MainArgs } from '#p/MainArgs';
import { SystemInit } from '#p/SystemInit';
import { UsualSystem } from '#p/UsualSystem';


export default async function main() {
  SystemInit.init();

  const args = new MainArgs(process.argv);
  args.parse();

  const system      = new UsualSystem(args);
  const keepRunning = new KeepRunning();

  keepRunning.run();
  Debugging.handleDebugArgs(args.debugArgs, system);
  await system.run();

  keepRunning.stop();

  // This `await` is not ever supposed to return.
  await Host.exit();
  throw new Error('Shouldn\'t happen.');
}
