// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import { pid as processPid } from 'node:process';

import { Threadlet } from '@this/async';
import { WallClock } from '@this/clocky';
import { Duration } from '@this/data-values';
import { Statter } from '@this/fs-util';
import { ProcessUtil } from '@this/host';
import { MustBe } from '@this/typey';
import { BaseFileService } from '@this/webapp-util';


/**
 * Service which writes process ID files to the filesystem. These are files that
 * just contain a simple process ID or list of same (in cases where multiple
 * processes are expected to write to the same file).
 *
 * See `doc/configuration` for configuration object details.
 *
 * **Note:** See {@link #ProcessInfoFile} for a service which writes more
 * complete information about the system.
 */
export class ProcessIdFile extends BaseFileService {
  /**
   * Threadlet which runs this service.
   *
   * @type {Threadlet}
   */
  #runner = new Threadlet((ra) => this.#run(ra));

  // @defaultConstructor

  /** @override */
  async _impl_start() {
    await this.#runner.start();
    await super._impl_start();
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#runner.stop();
    await super._impl_stop(willReload);
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
    const pid = processPid;

    if (!this.config.multiprocess) {
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
          && ProcessUtil.processExists(num)) {
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
    const filePath = this.config.path;

    try {
      if (await Statter.fileExists(filePath)) {
        return await fs.readFile(filePath, { encoding: 'utf-8' });
      } else {
        return '';
      }
    } catch (e) {
      this.logger?.errorReadingFile(e);
      return '';
    }
  }

  /**
   * Runs the service thread.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess Thread runner access object.
   */
  async #run(runnerAccess) {
    const updateMsec = this.config.updatePeriod?.msec ?? null;

    while (!runnerAccess.shouldStop()) {
      await this.#updateFile(true);

      if (updateMsec) {
        const timeout = WallClock.waitForMsec(updateMsec);
        await runnerAccess.raceWhenStopRequested([timeout]);
      } else {
        await runnerAccess.whenStopRequested();
      }
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
    const maxAttempts = ProcessIdFile.#MAX_WRITE_ATTEMPTS;

    for (let i = 0; i < maxAttempts; i++) {
      if (i !== 0) {
        this.logger?.writeContention({ attempt: i + 1 });
      }

      const filePath = this.config.path;
      const contents = await this.#makeContents(running);

      if (contents === '') {
        await fs.rm(filePath, { force: true });
        this.logger?.removedFile();
      } else {
        await this._prot_createDirectoryIfNecessary();
        await fs.writeFile(filePath, contents);
        this.logger?.wroteFile();
      }

      if (!running) {
        return;
      }

      // Wait a moment, and then check to see if the file is actually what
      // we wrote (but only if `running === true`, because if we're about to
      // shut down, we can rely on "partner" processes to ultimately do the
      // right thing).
      await WallClock.waitForMsec(ProcessIdFile.#PRE_CHECK_DELAY_MSEC);
      const readBack = await this.#readFile();
      if (readBack === contents) {
        return;
      }

      await WallClock.waitForMsec(ProcessIdFile.#RETRY_DELAY_MSEC);
    }

    this.logger?.writeContention({ attempt: maxAttempts, gaveUp: true });
  }


  //
  // Static members
  //

  /**
   * How many attempts should be made to write the file?
   *
   * @type {number}
   */
  static #MAX_WRITE_ATTEMPTS = 5;

  /**
   * How long to wait after writing before checking, in msec.
   *
   * @type {number}
   */
  static #PRE_CHECK_DELAY_MSEC = 250;

  /**
   * How long to wait before retrying a write, in msec.
   *
   * @type {number}
   */
  static #RETRY_DELAY_MSEC = 500;

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
      // @defaultConstructor

      /**
       * Allow multiple processes to be listed in the file?
       *
       * @param {boolean} [value] Proposed configuration value. Default `false`.
       * @returns {boolean} Accepted configuration value.
       */
      _config_multiprocess(value = false) {
        return MustBe.boolean(value);
      };

      /**
       * How often to update the process ID file, or `null` to not perform
       * updates. If passed as a string, it is parsed by {@link Duration#parse}.
       *
       * @param {?string|Duration} value Proposed configuration value. Default
       *   `null`.
       * @returns {?Duration} Accepted configuration value.
       */
      _config_updatePeriod(value = null) {
        if (value === null) {
          return null;
        }

        const result = Duration.parse(value, { range: { minInclusive: 1 } });

        if (!result) {
          throw new Error(`Could not parse \`updatePeriod\`: ${value}`);
        }

        return result;
      }
    };
  }
}
