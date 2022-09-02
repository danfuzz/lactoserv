// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Main } from '@this/main';

import * as timer from 'node:timers';

// This is a standard-ish trick to keep a Node process alive while waiting for
// a promise to resolve: Set a recurring timeout, and "unref" it when it's okay
// for the process to exit.
const keepAlive = () => {
  console.log('System has been up for a(nother) day!');
};
const oneDayMsec = 1000 * 60 * 60 * 24;
const keepAliveTimeout = timer.setInterval(keepAlive, oneDayMsec);

const exitCode = await Main.run(process.argv);
timer.clearInterval(keepAliveTimeout);

if (exitCode === 0) {
  console.log('Top-level application exiting without error.');
} else {
  console.log('Top-level application exiting with error code: %d', exitCode);
}

process.exit(exitCode);
