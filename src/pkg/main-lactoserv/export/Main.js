// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Debugging } from '#p/Debugging';
import { MainArgs } from '#p/MainArgs';
import { UsualSystem } from '#p/UsualSystem';


/**
 * Top-level logic for starting a server.
 */
export class Main {
  /**
   * Runs the system, based on the given command-line arguments.
   *
   * @param {MainArgs} args Command-line arguments.
   * @returns {number} Process exit code.
   */
  static async run(args) {
    const system = new UsualSystem(args);
    Debugging.handleDebugArgs(args, system);

    await system.run();

    return 0;
  }
}
