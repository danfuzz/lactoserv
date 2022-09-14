// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { SignalHandler } from '#p/SignalHandler';
import { TopErrorHandler } from '#p/TopErrorHandler';

import { Warehouse } from '@this/app-servers';
import { JsonExpander } from '@this/json';
import { Dirs } from '@this/util-host';

import * as timers from 'node:timers/promises';

/**
 * Top-level logic for starting a server.
 */
export class Main {
  /**
   * Runs the system, based on the given command-line arguments.
   *
   * @param {string[]} args_unused Command-line arguments to parse and act upon.
   * @returns {number} Process exit code.
   */
  static async run(args_unused) {
    SignalHandler.init();
    TopErrorHandler.init();

    const setupDir  = Dirs.basePath('etc/example-setup');
    const jx        = new JsonExpander(setupDir);
    const config    = await jx.expandFileAsync('config/config.json');
    const warehouse = new Warehouse(config);

    console.log('\n### Starting all servers...\n');
    await warehouse.startAllServers();
    console.log('\n### Started all servers.\n');

    await timers.setTimeout(15 * 1000);

    console.log('\n### Stopping all servers...\n');
    await warehouse.stopAllServers();
    console.log('\n### Stopped all servers.\n');

    return 0;
  }
}
