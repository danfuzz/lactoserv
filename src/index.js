// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { default as main } from '@this/main';


await main();

// The `await` above is expected never to return.
throw new Error('Shouldn\'t happen.');
