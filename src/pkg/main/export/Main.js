// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Warehouse } from '@this/app-servers';
import { Dirs } from '@this/util-host';

import * as fs from 'node:fs/promises';
import * as timers from 'node:timers';
import * as url from 'node:url';

/**
 * Top-level logic for starting a server.
 */
export class Main {
  /**
   * Runs the system, based on the given command-line arguments.
   *
   * @param {string[]} args_unused Command-line arguments to parse and act
   *   upon.
   * @returns {number} Process exit code.
   */
  static async run(args_unused) {
    // Way more TODO.
    console.log('TODO!');

    const certsPath = Dirs.basePath('etc/certs');
    const hostsConfig = [
      {
        name: '*',
        cert: await fs.readFile(certsPath + '/localhost-cert.pem', 'utf-8'),
        key:  await fs.readFile(certsPath + '/localhost-key.pem', 'utf-8')
      },
      {
        names: ['localhost', '*.localhost', 'milk.com', '*.milk.com', 'example.milk.com'],
        cert: await fs.readFile(certsPath + '/localhost-cert.pem', 'utf-8'),
        key:  await fs.readFile(certsPath + '/localhost-key.pem', 'utf-8')
      }
    ];

    const assetsPath = url.fileURLToPath(new URL('../assets', import.meta.url));

    const httpsConfig_unused = {
      hosts:      hostsConfig,
      server: {
        name:       'secure',
        app:        'my-static-fun',
        host:       '*',
        interface:  '*',
        port:       8443,
        protocol:   'https'
      },
      app: {
        name:       'my-static-fun',
        mount:      '//secure/',
        type:       'static-server',
        assetsPath
      }
    };

    const comboConfig = {
      hosts: hostsConfig,
      servers: [
        {
          name:       'insecure',
          app:        'my-wacky-redirector',
          host:       '*',
          interface:  '*',
          port:       8080,
          protocol:   'http'
        },
        {
          name:       'also-insecure',
          apps:       ['my-static-fun'],
          hosts:      ['*'],
          interface:  '*',
          port:       8081,
          protocol:   'http',
        },
        {
          name:       'secure',
          apps:       ['my-static-fun'],
          host:       '*',
          interface:  '*',
          port:       8443,
          protocol:   'http2'
        }
      ],
      apps: [
        {
          name:      'my-wacky-redirector',
          mounts:    ['//*/'],
          type:      'redirect-server',
          redirects: [
            {
              fromPath: '/',
              toUri:    'https://milk.com/boop/'
            }
          ]
        },
        {
          name: 'my-static-fun',
          mount: '//*/',
          type: 'static-server',
          assetsPath
        }
      ]
    };

    const warehouse = new Warehouse(comboConfig);
    const sm = warehouse.serverManager;
    const servers = [
      sm.findController('secure'),
      sm.findController('insecure'),
      sm.findController('also-insecure')
    ];

    for (const s of servers) {
      console.log(`### Starting server: ${s.name}`);
      await s.start();
      console.log('### Started.');
      console.log();

      const doStop = async () => {
        console.log(`### Stopping server: ${s.name}`);
        await s.stop();
        console.log(`### Stopped server: ${s.name}`);
      }

      timers.setTimeout(doStop, 15 * 1000);
    }

    console.log('### Waiting for servers to stop...');

    const stops = servers.map(s => {
      return (async () => {
        console.log(`### Waiting for server: ${s.name}`);
        await s.whenStopped();
        console.log(`### Server now stopped: ${s.name}`);
      })();
    });

    const result = await Promise.all(stops);
    console.log('### All stopped!');

    return 0;
  }
}
