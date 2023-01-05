// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-services';
import { Host, ProcessInfo, ProductInfo } from '@this/host';
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

  /** @type {?object} Current info file contents, if known. */
  #contents = null;


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
    this.#contents = await this.#makeContents();
    await this.#writeFile();
  }

  /** @override */
  async stop() {
    const contents     = this.#contents;
    const stopTimeSecs = Date.now() / 1000;
    const runTimeSecs  = stopTimeSecs - contents.startTime.secs;

    contents.stopTime = {
      str:  FormatUtils.dateTimeStringFromSecs(stopTimeSecs),
      secs: stopTimeSecs
    };
    contents.runTimeSecs = runTimeSecs;

    if (runTimeSecs > (60 * 60)) {
      const runTimeHours = runTimeSecs / (60 * 60);
      contents.runTimeHours = runTimeHours;
      if (runTimeHours > 24) {
        contents.runTimeDays = runTimeHours / 24;
      }
    }

    if (Host.isShuttingDown()) {
      contents.disposition = Host.shutdownDisposition();
    } else {
      contents.disposition = { restarting: true };
    }

    // Try to get `earlierRuns` to be a the end of the object when it gets
    // encoded to JSON, for easier (human) reading.
    if (contents.earlierRuns) {
      const earlierRuns = contents.earlierRuns;
      delete contents.earlierRuns;
      contents.earlierRuns = earlierRuns;
    }

    await this.#writeFile();
  }

  /** @returns {string} The path to the info file. */
  get #filePath() {
    const fileName = `${this.#baseName}-${process.pid}.json`;
    const fullPath = Path.resolve(this.#directory, fileName);

    return fullPath;
  }

  /**
   * Makes the initial value for {@link #contents}.
   *
   * @returns {object} The contents.
   */
  async #makeContents() {
    const contents = {
      product: ProductInfo.allInfo,
      ...ProcessInfo.allInfo
    };

    const fileContents = await this.#readFile();

    if (fileContents) {
      if (fileContents.earlierRuns) {
        const earlier = fileContents.earlierRuns;
        delete fileContents.earlierRuns;
        earlier.push(fileContents);
        contents.earlierRuns = earlier;
      } else {
        contents.earlierRuns = [fileContents];
      }

      // Given that the file already exists, this is a restart, and so the
      // `startTime` from `ProcessInfo` (which will appear in the earliest of
      // the `earlierRuns`) is kinda moot. Instead, substitute the current time,
      // that is, the _restart_ time.
      const startTimeMsec = Date.now();
      const startTimeSecs = startTimeMsec / 1000;
      contents.startTime = {
        str:  FormatUtils.dateTimeStringFromSecs(startTimeSecs),
        secs: startTimeSecs
      };
    }

    return contents;
  }

  /**
   * Reads the info file, if it exists. If it exists but can't be read and
   * parsed, the problem is reported via the returned contents (stringified
   * exception).
   *
   * @returns {?object} Parsed info file if it exists, or `null` if the file
   *   does not exist.
   */
  async #readFile() {
    const filePath = this.#filePath;

    try {
      await fs.stat(filePath);
      const text = await fs.readFile(filePath);

      return JSON.parse(text);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return null;
      } else {
        return { error: e.stack };
      }
    }
  }

  /**
   * Writes the info file.
   */
  async #writeFile() {
    const filePath = this.#filePath;

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

    const text = `${JSON.stringify(this.#contents, null, 2)}\n`;
    await fs.writeFile(filePath, text);
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
