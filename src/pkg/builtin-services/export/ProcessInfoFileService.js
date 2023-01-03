// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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

  /** @type {object} Last-written info file contents. */
  #contents;


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
    this.#contents  = ProcessInfo.allInfo;
  }

  /** @override */
  async start() {
    // TODO: Read already-existing file.

    await this.#writeFile();
  }

  /** @override */
  async stop() {
    const stopTimeSecs = Date.now() / 1000;
    const stopTime     = FormatUtils.dateTimeStringFromSecs(stopTimeSecs);

    this.#contents = {
      ...this.#contents,
      stopTime,
      stopTimeSecs
    };

    await this.#writeFile();
  }

  /**
   * Writes the info file.
   */
  async #writeFile() {
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

    const text     = `${JSON.stringify(this.#contents, null, 2)}\n`;
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

      this.#baseName  = Files.checkFileName(config.baseName);
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
