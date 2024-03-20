// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as builtIns from '@this/built-ins';
import { Host, KeepRunning } from '@this/host';

import { Debugging } from '#p/Debugging';
import { MainArgs } from '#p/MainArgs';
import { UsualSystem } from '#p/UsualSystem';


export default async function main() {
  // This is just a nominal reference to keep the build system from thinking
  // that the `built-ins` module is unused. (It _isn't_ used in the framework,
  // but it still needs to be available when loading configuration files.)
  if (builtIns === null) {
    throw new Error('Something is very wrong.');
  }

  Host.init();

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
