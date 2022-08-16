// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { StaticServer } from '@this/static-server';

/**
 * Top-level logic for starting a server.
 */
export class Main {
  /**
   * Runs the system, based on the given command-line arguments.
   *
   * @param {array<string>} args Command-line arguments to parse and act upon.
   * @returns {Int|null} Process exit code, or `null` to indicate that the
   *   process should not exit once the immediate action is complete.
   */
  static async run(args) {
    console.log('TODO!')

    // Way more TODO.
    const server = new StaticServer();
    console.log('### main 1');
    await server.start();
    console.log('### main 2');

    return 0;
  }
}
