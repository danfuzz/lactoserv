// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { StaticServer } from '@this/static-server';
import { Something } from '@this/just-a-test'; // TODO: Remove!

/**
 * Top-level logic for starting a server.
 */
export class Server {
  /**
   * Starts the server, based on the given command-line arguments.
   *
   * @param {array<string>} args Command-line arguments to parse and act upon.
   * @returns {Int|null} Process exit code, or `null` to indicate that the
   *   process should not exit once the immediate action is complete.
   */
  static async run(args) {
    console.log('TODO!')

    // Way more TODO.
    const server = new StaticServer();
    server.start();

    return 0;
  }

  /**
   * Calls {@link #run}, and responds to a non-`null` return value by exiting
   * the process.
   *
   * @param {array<string>} args Same as for {@link #run}.
   */
  static async runAndExit(args) {
    const exitCode = await Server.run(args);

    if (exitCode !== null) {
      process.exit(exitCode);
    }
  }
}
