// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { KeepRunning } from '@this/host';
import { Main } from '@this/main';


const keepRunning = new KeepRunning();
keepRunning.run();

const exitCode = await Main.run(process.argv);

keepRunning.stop();

if (exitCode === 0) {
  console.log('Top-level application exiting without error.');
} else {
  console.log('Top-level application exiting with error code: %d', exitCode);
}

await Main.exit(exitCode);
