// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Host, KeepRunning } from '@this/host';

import { Debugging } from '#p/Debugging';
import { MainArgs } from '#p/MainArgs';
import { SystemInit } from '#p/SystemInit';
import { UsualSystem } from '#p/UsualSystem';
import { WarehouseMaker } from '#p/WarehouseMaker';


export default async function main() {
  SystemInit.init();

  const args = new MainArgs(process.argv);
  args.parse();

  if (args.parsedArgs.dryRun) {
    let exitCode = 0;

    try {
      await args.warehouseMaker.make();
      console.log('Configuration file is valid.');
    } catch (e) {
      console.log('Configuration file trouble:\n%s\n\n%s', e.message, e.stack);
      exitCode = 1;
    }

    await Host.exit(exitCode);
  }

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
