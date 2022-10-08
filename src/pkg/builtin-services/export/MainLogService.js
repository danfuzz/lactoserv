// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

import { BaseService } from '@this/app-services';
import { JsonSchema } from '@this/json';
import { Loggy, TextFileSink } from '@this/loggy';


/**
 * Service which writes the main log to the filesystem. Configuration object
 * details:
 *
 * * `{string} directory` -- Absolute path to the directory to write to.
 * * `{string} baseName` -- Base file name for the log files.
 */
export class MainLogService extends BaseService {
  /** @type {string} Full path to the log file. */
  #logFilePath;

  /** @type {TextFileSink} Event sink which does the actual writing. */
  #sink;

  /**
   * Constructs an instance.
   *
   * @param {object} config Application-specific configuration object.
   */
  constructor(config) {
    super();

    MainLogService.#validateConfig(config);
    this.#logFilePath = Path.resolve(config.directory, `${config.baseName}.txt`);
    this.#sink        = new TextFileSink(this.#logFilePath, Loggy.earliestEvent);
  }

  /** @override */
  async start() {
    const dirPath = Path.resolve(this.#logFilePath, '..');

    // Create the log directory if it doesn't already exist.
    try {
      await fs.stat(dirPath);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw e;
      }
    }

    await this.#sink.start();
  }

  /** @override */
  async stop() {
    await this.#sink.drainAndStop();
  }


  //
  // Static members
  //

  /** @returns {string} Service type as used in configuration objects. */
  static get TYPE() {
    return 'main-log';
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema('Main Log Configuration');

    const namePattern = '^[^/]+$';
    const pathPattern =
      '^' +
      '(?!.*/[.]{1,2}/)' + // No dot or double-dot internal component.
      '(?!.*/[.]{1,2}$)' + // No dot or double-dot final component.
      '(?!.*//)' +         // No empty components.
      '(?!.*/$)' +         // No slash at the end.
      '/[^/]';             // Starts with a slash. Has at least one component.

    validator.addMainSchema({
      $id: '/MainLogService',
      type: 'object',
      required: ['baseName', 'directory'],
      properties: {
        baseName: {
          type: 'string',
          pattern: namePattern
        },
        directory: {
          type: 'string',
          pattern: pathPattern
        }
      }
    });

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
