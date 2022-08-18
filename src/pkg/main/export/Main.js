// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { StaticServer } from '@this/static-server';
import { Dirs } from '@this/util-server';

import * as fs from 'node:fs/promises';
import * as timers from 'timers';

/**
 * Top-level logic for starting a server.
 */
export class Main {
  /**
   * Runs the system, based on the given command-line arguments.
   *
   * @param {array<string>} args Command-line arguments to parse and act upon.
   * @returns {Int} Process exit code.
   */
  static async run(args) {
    // Way more TODO.
    console.log('TODO!')

    const httpConfig = {
      protocol: 'http',
      port:     8080
    };

    const certsDir = Dirs.basePath('etc/certs');
    const httpsConfig = {
      protocol: 'https',
      port:     8443,
      key:      await fs.readFile(certsDir + '/localhost.key'),
      cert:     await fs.readFile(certsDir + '/localhost.crt')
    };

    const server = new StaticServer(httpsConfig);
    await server.start();

    function doStop() {
      console.log('Stopping...');
      server.stop();
    }

    timers.setTimeout(doStop, 30 * 1000);

    await server.whenStopped();
    console.log('Stopped!');

    return 0;
  }
}
