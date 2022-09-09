// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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

    /*
    console.log('\n#####################\n');
    const testJson1 = {
      a: { $await: () => 'hello' },
      b: [1, 2, 3, { $await: () => [1, 2, 3] }],
      c: {
        x: 10,
        y: { $await: () => 20 },
        z: 30
      }
    };
    const testJson2 = {
      a: [1, 2, 3],
      b: {
        x: 'xx', y: 'yy', z: ['z', 'zz', 'zzz'], q: null, tf: [true, false]
      },
      c: true,
      d: null
    };
    const testJson3 = {
      a: [1, 2, 3, { $ref: '#/$defs/boop' }],
      b: {
        x: 'xx', y: 'yy', z: ['z', 'zz', 'zzz', { $ref: '#/$defs/boop' }],
        q: null, tf: [true, false]
      },
      c: { $ref: '#/$defs/boop' },
      d: { $ref: '#/$defs/beep' },
      e: [[], {}, null, false, ''],
      yes: { $quote: { $ref: 'not-a-ref' } },
      $defs: {
        boop: 'BOOP!',
        beep: ['beep', 'beep']
      },
      $baseDir: '/home/danfuzz/florp'
    };
    const testJson4 = {
      yo: { $await: () => 'hello' },
      wow1: { $readFile: './florp.txt', type: 'text' },
      wow2: { $readFile: './florp.json', type: 'rawJson' },
      wow3: { $readFile: './florp.json', type: 'json' },
      zomg: [1, 2, 3, { $readFile: './florp.txt' }, { $ref: '#/$defs/yay' }],
      $defs: {
        yay: 'YAY!!'
      }
    };
    const testJson5 = {
      $defs: {
        hi: 'HI'
      },
      $value: [1, 2, 3, { $ref: '#/$defs/hi' }]
    };
    const testJx = new JsonExpander('.');
    //const testResult = testJx.expand(testJson4);
    const testResult = await testJx.expandAsync(testJson4);
    console.log('\n##################### FINAL RESULT: \n');
    console.log('%o', testResult);
    console.log('\n#####################\n');
    process.exit(1);
    */
  }
}
