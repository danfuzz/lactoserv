// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { pathToFileURL } from 'node:url';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { ProductInfo } from '@this/host';
import { MustBe } from '@this/typey';

import { WarehouseMaker } from '#p/WarehouseMaker';


/**
 * Parser and container for top-level arguments and options.
 */
export class MainArgs {
  /**
   * Value of `process.argv` (or equivalent).
   *
   * @type {Array<string>}
   */
  #argv;

  /**
   * Parsed arguments.
   *
   * @type {?object}
   */
  #parsedArgs = null;

  /**
   * Warehouse maker, based on the passed configuration
   * URL.
   *
   * @type {?WarehouseMaker}
   */
  #warehouseMaker = null;

  /**
   * Constructs an instance.
   *
   * @param {Array<string>} argv Value of `process.argv` (or equivalent).
   */
  constructor(argv) {
    this.#argv = MustBe.arrayOfString(argv);
  }

  /** @returns {object} All of the debugging-related arguments. */
  get debugArgs() {
    const args = this.#parsedArgs;

    return {
      earlyErrors:   args.earlyErrors ?? false,
      logToStdout:   args.logToStdout ?? false,
      maxRunTimeSec: args.maxRunTimeSec ?? null
    };
  }

  /** @returns {object} All of the parsed arguments. */
  get parsedArgs() {
    return this.#parsedArgs;
  }

  /**
   * Warehouse maker, based on the passed configuration
   * location.
   *
   * @type {WarehouseMaker}
   */
  get warehouseMaker() {
    return this.#warehouseMaker;
  }

  /**
   * Parses the arguments. After calling this (and no error is thrown), the
   * various properties of this instance are valid.
   */
  parse() {
    const args = this.#parse0();

    this.#warehouseMaker = new WarehouseMaker(args.configUrl);
    this.#parsedArgs     = args;
  }

  /**
   * Helper for {@link #parse}, which performs the main parsing act.
   *
   * @returns {object} The validated and parsed result.
   */
  #parse0() {
    const args = hideBin(this.#argv);

    // Extract the expected "actual command name" option (passed in by the
    // wrapper script).
    const cmdName = yargs()
      .options({ 'outer-command-name': { string: true } })
      .help(false)
      .showHelpOnFail(false)
      .version(false)
      .parse(args)
      ?.outerCommandName ?? this.#argv[1];

    const versionString = `${ProductInfo.name} v${ProductInfo.version}`;

    const parser = yargs()
      .strict()
      .parserConfiguration({
        'halt-at-non-option': true
      })
      .usage(`${cmdName} <opt> ...`)
      .version(versionString)
      .options({
        'config': {
          describe:     'Configuration file (filesystem path)',
          conflicts:    'config-url',
          normalize:    true,
          requriresArg: true,
          string:       true
        },
        'config-url': {
          describe:    'Configuration URL',
          conflicts:   'config',
          requiresArg: true,
          string:      true
        },
        'early-errors': {
          describe: 'Debugging: Should some uncaught-ish errors be thrown soon after starting?',
          boolean:   true
        },
        'dry-run': {
          describe: '"Dry run." Just check the config file for correctness.',
          boolean:  true
        },
        'log-to-stdout': {
          describe: 'Debugging: Should log messages be printed to stdout?',
          boolean:   true
        },
        'max-run-time-sec': {
          describe: 'Debugging: Maximum run time in seconds',
          number:   true
        },
        'outer-command-name': {
          describe: 'Outer command name (for help messages)',
          hidden:   true,
          string:   true
        }
      })
      .check((argv, options_unused) => {
        const { config, configUrl } = argv;
        if ((config === undefined) && (configUrl === undefined)) {
          return 'Must pass at least one of --config or --config-url.';
        }
        return true;
      });

    const result = parser.parseSync(args);

    if (result.config) {
      result.configUrl = pathToFileURL(result.config);
      result.config    = undefined;
    } else {
      result.configUrl = new URL(result.configUrl);
    }

    return result;
  }
}
