// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-services';
import { IntfRequestLogger } from '@this/network-protocol';


/**
 * Service which writes the access log to the filesystem. Configuration object
 * details:
 *
 * * `{string} directory` -- Absolute path to the directory to write to.
 * * `{string} baseName` -- Base file name for the log files.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestLoggerService extends BaseService {
  /** @type {string} Full path to the log file. */
  #logFilePath;

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    const { baseName, directory } = config;

    this.#logFilePath = Path.resolve(directory, `${baseName}.txt`);
  }

  /** @override */
  async logCompletedRequest(line) {
    await fs.appendFile(this.#logFilePath, `${line}\n`);
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
  }

  /** @override */
  async stop() {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /** @override */
  static get TYPE() {
    return 'request-logger';
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ServiceConfig {
    /** @type {string} The base file name to use. */
    #baseName;

    /** @type {string} The directory to write to. */
    #directory;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#baseName = Files.checkFileName(config.baseName);
      this.#directory = Files.checkAbsolutePath(config.directory);
    }

    /** @returns {string} The base file name to use. */
    get baseName() {
      return this.#baseName;
    }

    /** @returns {string} The directory to write to. */
    get directory() {
      return this.#directory;
    }
  };
}
