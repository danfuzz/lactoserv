// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';
import * as process from 'node:process';
import * as timers from 'node:timers/promises';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-framework';
import { Threadlet } from '@this/async';
import { MustBe } from '@this/typey';


/**
 * Service which writes process ID files to the filesystem. These are files that
 * just contain a simple process ID or list of same (in cases where multiple
 * server processes are writing to the same file).
 *
 * * `{string} directory` -- Absolute path to the directory to write to.
 * * `{string} baseName` -- Base file name for the file.
 * * `{boolean} multiprocess` -- Allow multiple processes to be registered in a
 *   single file. Defaults to `false`.
 * * `{?number} updateSecs` -- How often to update the file, in seconds, or
 *   `null` to not perform updates. Defaults to `null`. It is recommended to
 *   have this be non-`null` when `multiprocess` is used, to minimize the chance
 *   of a concurrency tragedy leaving a messed up file around.
 *
 * **Note:** See {@link #ProcessInfoFileService} for a service which writes more
 * complete information about the system.
 */
export class ProcessIdFileService extends BaseService {
  /** @type {string} Base file name for the file. */
  #baseName;

  /** @type {string} Directory for info files. */
  #directory;

  /** @type {boolean} Allow multiple processes to be listed in the file? */
  #multiprocess;

  /**
   * @type {?number} How often to update the file, in seconds, or `null` to not
   * perform updates.
   */
  #updateSecs;

  /** @type {Threadlet} Threadlet which runs this service. */
  #runner = new Threadlet(() => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    const { baseName, directory, multiprocess, updateSecs } = config;
    this.#baseName     = baseName;
    this.#directory    = Path.resolve(directory);
    this.#multiprocess = multiprocess;
    this.#updateSecs   = updateSecs;
  }

  /** @override */
  async start() {
    await this.#runner.start();
  }

  /** @override */
  async stop() {
    await this.#runner.stop();
  }

  /** @returns {string} The path to the info file. */
  get #filePath() {
    return Path.resolve(this.#directory, this.#baseName);
  }

  /**
   * Adjusts the given file contents, to properly represent (a) whether this
   * process is running, and (b) whatever other processes are running (if this
   * instance is configured to support multiple processes).
   *
   * @param {string} contents The original contents.
   * @param {boolean} running Is this process/system considered to be running?
   * @returns {string} The new contents.
   */
  #adjustContents(contents, running) {
    const pid = process.pid;

    if (!this.#multiprocess) {
      // Easy case when not handling multiple processes.
      return running ? `${pid}\n` : '';
    }

    // This finds all runs of digits in `contents`, and is very forgiving of
    // any chaff that might be in the file. Note that it can produce an empty
    // element at the start or the end of the result.
    const original = contents.split(/[^0-9]+/);
    const result   = [];

    if (running) {
      result.push(pid);
    }

    for (const numStr of original) {
      const num = Number.parseInt(numStr);
      // Note: In addition to preventing the current `pid` from being added,
      // this catches both overly long strings of digits and the empty string
      // (which parses as `NaN`).
      if (   Number.isSafeInteger(num)
          && (num !== pid)
          && ProcessIdFileService.#processExists(num)) {
        result.push(num);
      }
    }

    if (result.length === 0) {
      return '';
    }

    // Sort in numerically increasing order.
    result.sort((x, y) => (x - y));

    return result.join('\n') + '\n';
  }

  /**
   * Runs the service thread.
   */
  async #run() {
    while (!this.#runner.shouldStop()) {
      await this.#updateFile(true);

      const updateTimeout = this.#updateSecs
        ? [timers.setTimeout(this.#updateSecs * 1000)]
        : [];

      await Promise.race([
        ...updateTimeout,
        this.#runner.whenStopRequested()
      ]);
    }

    await this.#updateFile(false);
  }

  /**
   * Updates the file, based on its existing contents (if any) and the fact of
   * whether or not this system is supposed to be considered to be running at
   * the moment.
   *
   * @param {boolean} running Is this process/system considered to be running?
   */
  async #updateFile(running) {
    const filePath = this.#filePath;
    let   contents = '';

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

    // Read the file if it exists.

    try {
      await fs.stat(filePath);
      contents = await fs.readFile(filePath, { encoding: 'utf-8' });

      this.logger.readFile();
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Ignore the error: It's okay if the file doesn't exist.
      } else {
        this.logger.errorReadingFile(e);
      }
    }

    // Construct/tweak the contents, and either write the file or delete it.

    contents = this.#adjustContents(contents, running);

    if (contents === '') {
      await fs.rm(filePath, { force: true });
    } else {
      await fs.writeFile(filePath, contents);
    }

    this.logger.wroteFile();
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
    return 'process-id-file';
  }

  /**
   * Checks to see if a process exists with the given ID.
   *
   * @param {number} pid The process ID to check for.
   * @returns {boolean} `true` iff the process exists.
   */
  static #processExists(pid) {
    try {
      // Note: Per Node docs, `kill` with the signal `0` merely checks for
      // process existence; just what we want here!
      process.kill(pid, 0);
      return true;
    } catch (e) {
      if (e.code === 'ESRCH') {
        // This is the expected "no such process ID" error.
        return false;
      } else {
        throw e;
      }
    }
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ServiceConfig {
    /** @type {string} The base file name to use. */
    #baseName;

    /** @type {string} The directory to write to. */
    #directory;

    /** @type {boolean} Allow multiple processes to be listed in the file? */
    #multiprocess;

    /**
     * @type {?number} How often to update the info file, in seconds, or `null`
     * to not perform updates.
     */
    #updateSecs;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#baseName   = Files.checkFileName(config.baseName);
      this.#directory  = Files.checkAbsolutePath(config.directory);
      this.#multiprocess = (typeof config.multiprocess === 'boolean')
        ? config.multiprocess
        : MustBe.null(config.multiprocess ?? null);
      this.#updateSecs = config.updateSecs
        ? MustBe.number(config.updateSecs, { finite: true, minInclusive: 1 })
        : MustBe.null(config.updateSecs ?? null);
    }

    /** @returns {string} The base file name to use. */
    get baseName() {
      return this.#baseName;
    }

    /** @returns {string} The directory to write to. */
    get directory() {
      return this.#directory;
    }

    /** @returns {boolean} Allow multiple processes to be listed in the file? */
    get multiprocess() {
      return this.#multiprocess;
    }

    /**
     * @returns {?number} How often to update the info file, in seconds, or
     * `null` to not perform updates.
     */
    get updateSecs() {
      return this.#updateSecs;
    }
  };
}
