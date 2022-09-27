// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { UsualSystem } from '#p/UsualSystem';

import { Host } from '@this/host';

import * as timers from 'node:timers/promises';

/**
 * Top-level logic for starting a server.
 */
export class Main {
  /**
   * Runs the system, based on the given command-line arguments.
   *
   * @param {string[]} args Command-line arguments to parse and act upon.
   * @returns {number} Process exit code.
   */
  static async run(args) {
    Host.init();

    const system = new UsualSystem(args);

    await system.start();
    await timers.setTimeout(15 * 1000);
    await system.stop();

    return 0;
  }

  /**
   * Exits the system as cleanly as possible. The right way to use this is to
   * call this and `await` the return value... which will never actually get
   * resolved.
   *
   * @param {number} [exitCode = 0] Exit code.
   */
  static async exit(exitCode = 0) {
    return Host.exit(exitCode);
  }
}
