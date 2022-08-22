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

    const certsDir = Dirs.basePath('etc/certs');

    const httpConfig = {
      protocol: 'http',
      host:     '::',
      port:     8080
    };

    const httpsConfig = {
      protocol: 'https',
      host:     '::',
      port:     8443,
      key:      await fs.readFile(certsDir + '/localhost-key.pem', 'utf-8'),
      cert:     await fs.readFile(certsDir + '/localhost-cert.pem', 'utf-8')
    };

    const http2Config = {
      protocol: 'http2',
      host:     '::',
      port:     8443,
      key:      await fs.readFile(certsDir + '/localhost-key.pem', 'utf-8'),
      cert:     await fs.readFile(certsDir + '/localhost-cert.pem', 'utf-8')
    };

    const server = new StaticServer(http2Config);
    await server.start();

    function doStop() {
      console.log('Stopping...');
      server.stop();
    }

    timers.setTimeout(doStop, 15 * 1000);

    await server.whenStopped();
    console.log('Stopped!');

    return 0;
  }
}
