// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Main } from '@this/main';

console.log('Hello!');
const exitCode = await Main.run(process.argv);
console.log('Exit code: ' + exitCode);
process.exit(exitCode);
