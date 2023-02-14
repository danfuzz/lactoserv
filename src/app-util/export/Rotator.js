// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import * as timers from 'node:timers/promises';

import { FileServiceConfig } from '@this/app-config';
import { Condition, Threadlet } from '@this/async';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Configurable file "rotator" for doing log rotation and the like.
 */
export class Rotator {
  /** @type {FileServiceConfig} Configuration to use. */
  #config;

  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /**
   * @type {?number} How long to wait between checks, in msec, if timed checks
   * are to be done; or `null` not to do such checks.
   */
  #checkMsec;

  /** @type {?string} Infix used the last time rotation was done. */
  #lastInfix = null;

  /**
   * @type {?string} Count after the infix used the last time rotation was
   * done.
   */
  #lastInfixCount = 0;

  /** @type {Threadlet} Thread which runs this instance. */
  #runner = new Threadlet(() => this.#run());

  /** @type {Condition} Condition which indicates a need to rotate now. */
  #rotateNow = new Condition();

  /**
   * @type {Condition} Condition which becomes momentarily `true` at the end of
   * each rotation action.
   */
  #rotatedCondition = new Condition();

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration to use.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    this.#config = MustBe.instanceOf(config, FileServiceConfig);
    this.#logger = logger ? logger.rotator : null;

    this.#checkMsec = (config.rotate.checkSecs === null)
      ? null
      : config.rotate.checkSecs * 1000;
  }

  /**
   * Starts this instance.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async start(isReload) {
    this.#runner.start();

    if (isReload) {
      if (this.#config.rotate.onReload) {
        this.#rotateNow.value = true;
      }
    } else {
      if (this.#config.rotate.onStart) {
        this.#rotateNow.value = true;
      }
    }

    const logArgs = isReload ? ['reload'] : [];
    this.#logger?.started(...logArgs);
  }

  /**
   * Informs this instance that the system has stopped.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload) {

    if (this.#config.rotate.onStop && !willReload) {
      this.#rotateNow.value = true;
      await this.#rotateNow.whenFalse();
    }

    await this.#runner.stop();

    const logArgs = willReload ? ['reload'] : [];
    this.#logger?.stopped(...logArgs);
  }

  /**
   * Returns a promise which gets fulfilled to `true` the next time a rotation
   * is performed.
   *
   * @returns {Promise} A promise as described.
   */
  whenRotated() {
    return this.#rotatedCondition.whenTrue();
  }

  /**
   * Deletes old (post-rotation) files, as configured.
   */
  async #deleteOldFiles() {
    const { maxOldCount = null, maxOldBytes = null } = this.#config.rotate;

    if ((maxOldCount === null) && (maxOldBytes === null)) {
      // Not configured to do a deletion pass.
      return;
    }

    // Find all the files, and sort from newest to oldest.
    const files = await this.#findFiles({ today: true, pastDays: true });
    files.sort((x, y) => y.birthtime.valueOf() - x.birthtime.valueOf());

    let count = 0;
    let bytes = 0;

    for (const f of files) {
      bytes += f.size;
      count++;
      if (   ((maxOldCount !== null) && (count > maxOldCount))
          || ((maxOldBytes !== null) && (bytes > maxOldBytes))) {
        await fs.unlink(f.fullPath);
        this.#logger?.deleted(f.fullPath);
      }
    }
  }

  /**
   * Finds all the files that match the configured file name pattern.
   *
   * @param {object} [options = {}] Options for the search, which define a union
   *   of items to find:
   *   * `{boolean} current = false` -- Find the current (unmodified name) log
   *        file?
   *   * `{boolean} today = false` -- Find files with today's date (UTC)?
   *   * `{boolean} pastDays = false` -- Find files from previous days (UTC)?
   *   * `{?string} dateStr = null` -- Find files infixed with the given date
   *       string?
   * @returns {object[]} Array of useful information about each matched file.
   */
  async #findFiles(options = {}) {
    const {
      current  = false,
      today    = false,
      pastDays = false,
      dateStr  = null
    } = options;

    const todayStr   = Rotator.#makeInfix(new Date());
    const directory  = this.#config.directory;
    const basePrefix = this.#config.basePrefix;
    const baseSuffix = this.#config.baseSuffix;
    const contents   = await fs.readdir(directory);
    const result     = [];

    for (const name of contents) {
      const parsed = Rotator.#parseInfix(name, basePrefix, baseSuffix);
      if (parsed === null) {
        continue;
      }

      const { dateStr: gotDate, count } = parsed;

      if (gotDate === null) {
        if (!current) continue;
      } else if (gotDate !== dateStr) {
        if (gotDate === todayStr) {
          if (!today) continue;
        } else if (!pastDays) {
          continue;
        }
      }

      const fullPath = `${directory}/${name}`;
      const stats = await fs.stat(fullPath);
      result.push({
        name,
        fullPath,
        dateStr,
        count,
        birthtime: stats.birthtime,
        size:      stats.size
      });
    }

    return result;
  }

  /**
   * Rotates the file and does any other related actions, as configured.
   */
  async #rotate() {
    const origPath = this.#config.resolvePath();
    let   stats;

    try {
      stats = await fs.stat(origPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        this.#logger?.errorWithStat(e);
      }
      return;
    }

    try {
      const targetPath = await this.#targetPath(stats);
      await fs.rename(origPath, targetPath);
      this.#logger?.rotatedTo(targetPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        this.#logger?.errorWithRename(e);
      }
    }

    await this.#deleteOldFiles();

    this.#rotatedCondition.onOff();
  }

  /**
   * Main function of the threadlet for this instance.
   */
  async #run() {
    while (!this.#runner.shouldStop()) {
      if (   (this.#rotateNow.value === true)
          || await this.#shouldRotate()) {
        await this.#rotate();
        this.#rotateNow.value = false;
      }

      const checkTimeout = this.#checkMsec
        ? [timers.setTimeout(this.#checkMsec)]
        : [];

      await Promise.race([
        this.#rotateNow.whenTrue(),
        this.#runner.whenStopRequested(),
        ...checkTimeout
      ]);
    }
  }

  /**
   * Should the file be rotated? This is only `true` when configured for timed
   * checks, and the checks indicate a rotation is necessary.
   *
   * @returns {boolean} `true` iff the file should be rotated.
   */
  async #shouldRotate() {
    if (!this.#checkMsec) {
      // Not configured to do timed checks.
      return false;
    }

    try {
      const stats = await fs.stat(this.#config.resolvePath());
      if (stats.size >= this.#config.rotate.atSize) {
        return true;
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return false;
      } else {
        this.#logger?.errorWithStat(e);
        return false;
      }
    }

    return false;
  }

  /**
   * Figures out the target (post-rotation) file name/path. It is based on the
   * creation date of the original, with an infix included in case of
   * contention.
   *
   * @param {fs.Stats} stats Result of `fs.stat()` on the original file path.
   * @returns {string} The post-rotation path.
   */
  async #targetPath(stats) {
    const dateStr = Rotator.#makeInfix(stats.birthtime);
    const resolve = (count) => {
      const infix = Rotator.#makeInfix(dateStr, (count > 0) ? count : null);
      return this.#config.resolvePath(`-${infix}`);
    };

    if (this.#lastInfix === dateStr) {
      // Optimistically assume that if we've already picked a previous file name
      // with the given date that the next one in sequence will work. If that
      // turns out to be wrong, we'll fall back to the more involved code.
      const count    = this.#lastInfixCount + 1;
      const firstTry = resolve(count);
      if (!await Rotator.#fileExists(firstTry)) {
        this.#lastInfixCount = count;
        return firstTry;
      }
    }

    // Find the highest existing count on existing files for the date in
    // question.

    const files = await this.#findFiles({ dateStr });
    let   count = -1;
    for (const f of files) {
      const oneCount = f.count ?? 0;
      if (oneCount > count) {
        count = oneCount;
      }
    }
    count++;

    this.#lastInfix      = dateStr;
    this.#lastInfixCount = count;
    return resolve(count);
  }


  //
  // Static members
  //

  /**
   * Checks to see if the given file exists.
   *
   * @param {string} filePath Path to the file.
   * @returns {boolean} The answer.
   */
  static async #fileExists(filePath) {
    try {
      await fs.stat(filePath);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Not found. Not a real error in this case.
        return false;
      }
      throw e;
    }
  }

  /**
   * Gets a date string with optional count to use as an "infix" for a rotated
   * file.
   *
   * @param {Date|string} date Date to derive the (UTC) date label for the file,
   *   or an already-derived date string.
   * @param {?count} [count = null] Count to include in the result, or `null` to
   *   not include a count.
   * @returns {string} The infix.
   */
  static #makeInfix(date, count = null) {
    const makeDateStr = () => {
      const year  = (date.getUTCFullYear()).toString();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day   = (date.getUTCDate()).toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const dateStr  = (typeof date === 'string') ? date : makeDateStr();
    const countStr = (count === null) ? '' : `-${count}`;

    return `${dateStr}${countStr}`;
  }

  /**
   * Parses the date and count out of a file name if it has the indicated prefix
   * and suffix. Returns `null` if the name doesn't match the pattern.
   *
   * @param {string} name The original name.
   * @param {string} prefix The required prefix for matching.
   * @param {string} suffix The required suffix for matching.
   * @returns {?{date: ?string, count: ?number}} The parsed result, or `null` if
   *   the name didn't match the pattern.
   */
  static #parseInfix(name, prefix, suffix) {
    if (!(name.startsWith(prefix) && name.endsWith(suffix))) {
      return null;
    }

    const infix = name.slice(prefix.length, name.length - suffix.length);

    if (infix === '') {
      return { dateStr: null, count: null };
    }

    const match = infix.match(/^-(?<dateStr>[0-9]{8})(?:-(?<countStr>[0-9]+))?$/);

    if (match) {
      const { dateStr, countStr } = match.groups;
      return { dateStr, count: countStr ? Number(countStr) : null };
    } else {
      return null;
    }
  }
}
