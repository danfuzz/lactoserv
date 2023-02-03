// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as timers from 'node:timers/promises';

import { FileServiceConfig } from '@this/app-config';
import { Condition, Threadlet } from '@this/async';
import { MustBe } from '@this/typey';


// TODO: This should probably use `Threadlet`.

/**
 * Configurable file "rotator" for doing log rotation and the like.
 */
export class Rotator {
  /** @type {FileServiceConfig} Configuration to use. */
  #config;

  /** @type {?function(*)} Logger to use, if any. */
  #logger;

  /**
   * @type {?number} How long to wait between checks, in msec, if timed checks
   * are to be done; or `null` if no such checking should be done.
   */
  #checkMsec;

  /** @type {?string} Suffix used the last time rotation was done. */
  #lastSuffix = null;

  /**
   * @type {?string} Count after the suffix used the last time rotation was
   * done.
   */
  #lastSuffixCount = 0;

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
   * @param {?function(*)} logger Logger to use, if any.
   */
  constructor(config, logger) {
    this.#config = MustBe.instanceOf(config, FileServiceConfig);
    this.#logger = logger ? logger.rotator : null;

    this.#checkMsec = (config.rotate.checkSecs === null)
      ? null
      : config.rotate.checkSecs * 1000;

    this.#logger?.constructed();
  }

  /**
   * Starts this instance.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async start(isReload) {
    const logArgs = isReload ? ['reload'] : [];

    this.#logger?.start(...logArgs);
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
  }

  /**
   * Informs this instance that the system has stopped.
   *
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload) {
    const logArgs = willReload ? ['reload'] : [];
    this.#logger?.stop(...logArgs);

    if (this.#config.rotate.onStop && !willReload) {
      this.#rotateNow.value = true;
      await this.#rotateNow.whenFalse();
    }

    this.#runner.stop();
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
    const files = await this.#findFiles({ current: false });
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
   * @param {object} [options = {}] Options for the search, all of which default
   *   to `true`:
   *   * `{boolean} current` -- Find the current (unmodified name) log file?
   *   * `{boolean} today` -- Find files with today's date (UTC)?
   *   * `{boolean} pastDays` -- Find files from previous days (UTC)?
   * @returns {object[]} Array of useful information about each matched file.
   */
  async #findFiles(options = {}) {
    const { current = true, today = true, pastDays = true } = options;

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

      const { dateStr, count } = parsed;

      if (dateStr === null) {
        if (!current) continue;
      } else if (dateStr === todayStr) {
        if (!today) continue;
      } else if (!pastDays) {
        continue;
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
      this.#logger?.running();
      if (   (this.#rotateNow.value === true)
          || await this.#shouldRotate()) {
        await this.#rotate();
        this.#rotateNow.value = false;
      }

      const checkTimeout = this.#checkMsec
        ? [timers.setTimeout(this.#checkMsec)]
        : [];

      this.#logger?.waiting();
      await Promise.race([
        this.#rotateNow.whenTrue(),
        this.#runner.whenStopRequested(),
        ...checkTimeout
      ]);
    }

    this.#logger?.done();
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
   * creation date of the original, with a suffix appended in case of
   * contention.
   *
   * @param {fs.Stats} stats Result of `fs.stat()` on the original file path.
   * @returns {string} The post-rotation path.
   */
  async #targetPath(stats) {
    const at     = stats.birthtime;
    const year   = (at.getUTCFullYear()).toString();
    const month  = (at.getUTCMonth() + 1).toString().padStart(2, '0');
    const day    = (at.getUTCDate()).toString().padStart(2, '0');
    const suffix = `-${year}${month}${day}`;

    let firstTry;

    if (suffix === this.#lastSuffix) {
      this.#lastSuffixCount++;
      const count = this.#lastSuffixCount;
      firstTry = this.#config.resolvePath(`${suffix}-${count}`);
    } else {
      this.#lastSuffix      = suffix;
      this.#lastSuffixCount = 0;
      firstTry = this.#config.resolvePath(suffix);
    }

    // If `firstTry` doesn't exist, then we're done. Otherwise, we have to
    // look through the directory to find an available name. (This can happen
    // when the system reloads or restarts.)

    try {
      await fs.stat(firstTry);
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Not found, so it's good!
        return firstTry;
      }
      throw e;
    }

    return this.#targetPathUsingDirectoryContents(suffix);
  }

  /**
   * Helper for {@link #targetPath}, which does the hard work of looking through
   * the directory to find the first available file.
   *
   * @param {string} suffix The prefix suffix (whee)
   * @returns {string} The post-rotation path.
   */
  async #targetPathUsingDirectoryContents(suffix) {
    const baseName   = this.#config.baseName;
    const baseSuffix = this.#config.baseSuffix;
    const fullPrefix = `${this.#config.basePrefix}${suffix}-`;
    const contents   = await fs.readdir(this.#config.directory);
    let foundCount   = -1;

    for (const name of contents) {
      if (name === baseName) {
        if (foundCount < 0) {
          foundCount = 0;
        }
      } else if (name.startsWith(fullPrefix) && name.endsWith(baseSuffix)) {
        const countStr = name.slice(fullPrefix.length, name.length - baseSuffix.length);
        const count    = Number(countStr);
        if (count > foundCount) {
          foundCount = count;
        }
      }
    }

    return (foundCount < 0)
      ? this.#config.resolvePath(suffix)
      : this.#config.resolvePath(`${suffix}-${foundCount + 1}`);
  }


  //
  // Static members
  //

  /**
   * Gets a date string with optional count to use as an "infix" for a rotated
   * file.
   *
   * @param {Date} date Date to derive the (UTC) date label for the file.
   * @param {?count} [count = null] Count to include in the result, or `null` to
   *   not include a count.
   * @returns {string} The infix.
   */
  static #makeInfix(date, count = null) {
    const year     = (date.getUTCFullYear()).toString();
    const month    = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day      = (date.getUTCDate()).toString().padStart(2, '0');
    const countStr = (count === null) ? '' : `-${count}`;

    return `${year}${month}${day}${countStr}`;
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
