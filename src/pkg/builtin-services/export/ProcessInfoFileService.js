// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-services';
import { ProcessInfo } from '@this/host';
import { FormatUtils } from '@this/loggy';


/**
 * Service which writes process info files to the filesystem. Configuration
 * object details:
 *
 * * `{string} directory` -- Absolute path to the directory to write to.
 * * `{string} baseName` -- Base file name for info files.
 */
export class ProcessInfoFileService extends BaseService {
  /** @type {string} Base file name for info files. */
  #baseName;

  /** @type {string} Directory for info files. */
  #directory;


  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    const { baseName, directory } = config;
    this.#baseName  = baseName;
    this.#directory = Path.resolve(directory);
  }

  /** @override */
  async start() {
    await this.#writeFile();
  }

  /** @override */
  async stop() {
    const stopTimeSecs = Date.now() / 1000;
    const stopTime     = FormatUtils.dateTimeStringFromSecs(stopTimeSecs);

    await this.#writeFile({ stopTime, stopTimeSecs });
  }

  /**
   * Writes the info file.
   *
   * @param {object} [extraInfo = {}] Extra information to write.
   */
  async #writeFile(extraInfo = {}) {
    const info = { ...Process.allInfo, ...extraInfo };

    // Create the directory if it doesn't already exist.

    try {
      await fs.stat(this.#directory);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fs.mkdir(this.#directory, { recursive: true });
      } else {
        throw e;
      }
    }

    // Write the file.

    const text     = JSON.toString(info);
    const fileName = `${this.#baseName}-${process.pid}.json`;
    const fullPath = Path.resolve(this.#directory, fileName);

    await fs.writeFile(fullPath, text);
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
    return 'process-info-file';
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
