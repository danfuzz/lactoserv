// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { RedirectApplication, StaticApplication, Warehouse } from '@this/app-servers';
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
    console.log('TODO!');

    const certsPath = Dirs.basePath('etc/certs');
    const hostsConfig = [
      {
        name: '*',
        cert: await fs.readFile(certsPath + '/localhost-cert.pem', 'utf-8'),
        key:  await fs.readFile(certsPath + '/localhost-key.pem', 'utf-8')
      }
    ];

    const assetsPath = url.fileURLToPath(new URL('../assets', import.meta.url));

    const httpsConfig = {
      hosts:      hostsConfig,
      server: {
        name:       'secure',
        interface:  '::',
        port:       8443,
        protocol:   'https'
      },
      app: {
        name:       'my-static-fun',
        mount:      '//secure/',
        type:       'static-server',
        assetsPath: assetsPath
      }
    };

    const comboConfig = {
      hosts: hostsConfig,
      servers: [
        {
          name:       'insecure',
          interface:  '::',
          port:       8080,
          protocol:   'http'
        },
        {
          name:       'also-insecure',
          interface:  '::',
          port:       8081,
          protocol:   'http',
        },
        {
          name:       'secure',
          interface:  '::',
          port:       8443,
          protocol:   'http2'
        }
      ],
      apps: [
        {
          name: 'my-wacky-redirector',
          mount: '//insecure/',
          type: 'redirect-server',
          redirects: [
            {
              fromPath: '/',
              toUri:    'https://milk.com/boop/'
            }
          ]
        },
        {
          name: 'my-static-fun',
          mount: '//secure/',
          type: 'static-server',
          assetsPath: assetsPath
        },
        {
          name: 'my-insecure-static-fun',
          mount: '//also-insecure/',
          type: 'static-server',
          assetsPath: assetsPath
        }
      ]
    };

    const warehouse = new Warehouse(comboConfig);
    const server1 = warehouse.makeSingleApplicationServer('my-static-fun');
    //const server1 = warehouse.makeSingleApplicationServer('my-insecure-static-fun');
    const server2 = warehouse.makeSingleApplicationServer('my-wacky-redirector');

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
