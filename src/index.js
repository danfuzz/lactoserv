// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Main } from '@this/main';

const exitCode = await Main.run(process.argv);

if (exitCode == 0) {
  console.log('Top-level application exiting without error.');
} else {
  console.log('Top-level application exiting with error code: %d', exitCode);
}

process.exit(exitCode);
