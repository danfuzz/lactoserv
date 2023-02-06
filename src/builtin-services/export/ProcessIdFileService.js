// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as process from 'node:process';
import * as timers from 'node:timers/promises';

import { FileServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-framework';
import { Threadlet } from '@this/async';
import { MustBe } from '@this/typey';


/**
 * Service which writes process ID files to the filesystem. These are files that
 * just contain a simple process ID or list of same (in cases where multiple
 * server processes are writing to the same file).
 *
 * Configuration object details:
 *
 * * Bindings as defined by the superclass configuration, {@link
 *   FileServiceConfig}.
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
  /** @type {boolean} Allow multiple processes to be listed in the file? */
  #multiprocess;

  /**
   * @type {?number} How often to update the file, in seconds, or `null` to not
   * perform updates.
   */
  #updateSecs;

  /** @type {string} Full path to the file. */
  #filePath;

  /** @type {Threadlet} Threadlet which runs this service. */
  #runner = new Threadlet(() => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    const { multiprocess, updateSecs } = config;
    this.#multiprocess = multiprocess;
    this.#updateSecs   = updateSecs;

    this.#filePath = config.resolvePath();
  }

  /** @override */
  async _impl_start(isReload_unused) {
    await this.#runner.start();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.#runner.stop();
  }

  /**
   * Makes the contents string for the file, to properly represent (a) this
   * process if it is to be considered running, and (b) whatever other processes
   * are running (if this instance is configured to support multiple processes).
   *
   * @param {boolean} running Is this process/system considered to be running?
   * @returns {string} The file contents.
   */
  async #makeContents(running) {
    const pid = process.pid;

    if (!this.#multiprocess) {
      // Easy case when not handling multiple processes.
      return running ? `${pid}\n` : '';
    }

    // The rest of this is for `multiprocess === true`.

    const contents = await this.#readFile();
    const result   = [];

    if (running) {
      result.push(pid);
    }

    // The `split()` call finds all runs of digits in `contents`, and is very
    // forgiving of any chaff that might be in the file. Note that it can
    // produce an empty element at the start or the end of the result.
    for (const numStr of contents.split(/[^0-9]+/)) {
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
   * Reads the existing process file, if it indeed exists.
   *
   * @returns {string} The file contents, or `''` (empty string) if it did not
   * exist or could not be read for some reason.
   */
  async #readFile() {
    const filePath = this.#filePath;

    try {
      await fs.stat(filePath);
      return await fs.readFile(filePath, { encoding: 'utf-8' });
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Ignore the error: It's okay if the file doesn't exist.
      } else {
        this.logger.errorReadingFile(e);
      }
      return '';
    }
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
    const maxAttempts = ProcessIdFileService.#MAX_WRITE_ATTEMPTS;

    for (let i = 0; i < maxAttempts; i++) {
      if (i !== 0) {
        this.logger.writeContention({ attempt: i + 1 });
      }

      const filePath = this.#filePath;
      const contents = await this.#makeContents(running);

      if (contents === '') {
        await fs.rm(filePath, { force: true });
        this.logger.removedFile();
      } else {
        await this.config.createDirectoryIfNecessary();
        await fs.writeFile(filePath, contents);
        this.logger.wroteFile();
      }

      if (!running) {
        return;
      }

      // Wait a moment, and then check to see if the file is actually what
      // we wrote (but only if `running === true`, because if we're about to
      // shut down, we can rely on "partner" processes to ultimately do the
      // right thing).
      await timers.setTimeout(ProcessIdFileService.#PRE_CHECK_DELAY_MSEC);
      const readBack = await this.#readFile();
      if (readBack === contents) {
        return;
      }

      await timers.setTimeout(ProcessIdFileService.#RETRY_DELAY_MSEC);
    }

    this.logger.writeContention({ attempt: maxAttempts, gaveUp: true });
  }


  //
  // Static members
  //

  /** @type {number} How many attempts should be made to write the file? */
  static #MAX_WRITE_ATTEMPTS = 5;

  /** @type {number} How long to wait after writing before checking, in msec. */
  static #PRE_CHECK_DELAY_MSEC = 250;

  /** @type {number} How long to wait before retrying a write, in msec. */
  static #RETRY_DELAY_MSEC = 500;

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
  static #Config = class Config extends FileServiceConfig {
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

      this.#multiprocess = (typeof config.multiprocess === 'boolean')
        ? config.multiprocess
        : MustBe.null(config.multiprocess ?? null);
      this.#updateSecs = config.updateSecs
        ? MustBe.number(config.updateSecs, { finite: true, minInclusive: 1 })
        : MustBe.null(config.updateSecs ?? null);
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
