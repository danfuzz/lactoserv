// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { RedirectServer, StaticServer } from '@this/app-servers';
import { Dirs } from '@this/util-host';

import * as fs from 'node:fs/promises';
import * as timers from 'timers';
import * as url from 'url';

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

    const certsPath = Dirs.basePath('etc/certs');
    const hostsConfig = [
      {
        name: '*',
        cert:       await fs.readFile(certsPath + '/localhost-cert.pem', 'utf-8'),
        key:        await fs.readFile(certsPath + '/localhost-key.pem', 'utf-8')
      }
    ];

    const assetsPath = url.fileURLToPath(new URL('../assets', import.meta.url));

    const httpConfig = {
      protocol:   'http',
      interface:  '::',
      port:       8080,
      what:       'static-server',
      assetsPath: assetsPath
    };

    const httpsConfig = {
      hosts:      hostsConfig,
      protocol:   'https',
      interface:  '::',
      port:       8443,
      key:        await fs.readFile(certsPath + '/localhost-key.pem', 'utf-8'),
      cert:       await fs.readFile(certsPath + '/localhost-cert.pem', 'utf-8'),
      what:       'static-server',
      assetsPath: assetsPath
    };

    const http2Config = {
      hosts:      hostsConfig,
      protocol:   'http2',
      interface:  '::',
      port:       8443,
      key:        await fs.readFile(certsPath + '/localhost-key.pem', 'utf-8'),
      cert:       await fs.readFile(certsPath + '/localhost-cert.pem', 'utf-8'),
      what:       'static-server',
      assetsPath: assetsPath
    };

    const httpRedirectConfig = {
      protocol:  'http',
      interface: '::',
      port:      8080,
      what:      'redirect-server',
      redirects: [
        {
          fromPath: '/',
          toUri:    'https://milk.com/boop/'
        }
      ]
    }

    const server1 = new StaticServer(http2Config);
    const server2 = new RedirectServer(httpRedirectConfig);

    if (server1) {
      console.log('Starting 1...');
      await server1.start();
      console.log('Started 1.');

      async function doStop1() {
        console.log('Stopping 1...');
        await server1.stop();
        console.log('Stopped 1.');
      }

      timers.setTimeout(doStop1, 15 * 1000);
    }

    if (server2) {
      console.log('Starting 2...');
      await server2.start();
      console.log('Started 2.');

      async function doStop1() {
        console.log('Stopping 2...');
        await server2.stop();
        console.log('Stopped 2.');
      }

      timers.setTimeout(doStop1, 15 * 1000);
    }

    if (server1) {
      await server1.whenStopped();
      console.log('Server 1 stopped!');
    }

    if (server2) {
      await server2.whenStopped();
      console.log('Server 2 stopped!');
    }

    return 0;
  }
}
