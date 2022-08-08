// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Server } from '@milk/top-server';

console.log('Hello!');
const exitCode = await Server.runAndExit(process.argv);
console.log('Exit code: ' + exitCode);
process.exit(exitCode);
