// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Condition, Threadlet } from '@this/async';
import { Statter } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { FileServiceConfig } from '@this/sys-config';
import { Methods, MustBe } from '@this/typey';


/**
 * Base class for "file preservation" (saving and/or rotation).
 *
 * **Note:** This class actually has the entire functionality of `Saver`, but
 * this class defines a couple of abstract `_impl_` methods that need to be
 * filled in (with no-ops in the case of `Saver`).
 */
export class BaseFilePreserver {
  /** @type {FileServiceConfig} Configuration to use. */
  #config;

  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /** @type {?string} Infix used for the most recently preserved file. */
  #lastInfix = null;

  /**
   * @type {?string} Count (in the infix) used for the most recently preserved
   * file.
   */
  #lastInfixCount = 0;

  /** @type {Threadlet} Thread which runs this instance. */
  #runner = new Threadlet(() => this.#run());

  /** @type {Condition} Condition which indicates a need to save now. */
  #saveNow = new Condition();

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration to use.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    this.#config = MustBe.instanceOf(config, FileServiceConfig);
    this.#logger = logger ? logger.saver : null;
  }

  /**
   * @type {?IntfLogger} Logger used by this instance. This is mostly for the
   * benefit of subclasses.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Starts this instance. If this instance is configured to take any start-time
   * actions (e.g. and especially preserving an existing file), this method does
   * not async-return until those actions are complete.
   *
   * @param {boolean} isReload Is this action due to an in-process reload?
   */
  async start(isReload) {
    this.#runner.start();

    if (isReload) {
      if (this.#config.save.onReload) {
        this.#saveNow.value = true;
        await this.#saveNow.whenFalse();
      }
    } else {
      if (this.#config.save.onStart) {
        this.#saveNow.value = true;
        await this.#saveNow.whenFalse();
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
    if (this.#config.save.onStop && !willReload) {
      this.#saveNow.value = true;
      await this.#saveNow.whenFalse();
    }

    await this.#runner.stop();

    const logArgs = willReload ? ['reload'] : [];
    this.#logger?.stopped(...logArgs);
  }

  /**
   * If the concrete subclass needs to perform occasional work synchronously
   * with respect to the threadlet which runs this instance, this method should
   * do that work. It is called just before checking to see if a save
   * (preservation) has been requested, including one final opportunity to save
   * just before the runner stops.
   *
   * @abstract
   */
  async _impl_doWork() {
    Methods.abstract();
  }

  /**
   * If the concrete subclass needs to perform occasional work synchronously
   * with respect to the threadlet which runs this instance in a timely manner
   * (interrupting a wait), this method should async-return (or return a promise
   * which gets resolved) when that work ought next to be performed. It should
   * return `null` if it never has to interrupt the threadlet.
   *
   * @abstract
   * @returns {?Promise} Optional promise which settles when work is to be done.
   */
  _impl_whenWorkRequired() {
    return Methods.abstract();
  }

  /**
   * Requests that the file be saved (preserved) as soon as possible. This
   * "protected" method is how subclasses get this class to act on their behalf.
   */
  _prot_saveNow() {
    this.#saveNow.value = true;
  }

  /**
   * Deletes old (post-preservation) files, as configured.
   */
  async #deleteOldFiles() {
    const { maxOldCount = null, maxOldBytes = null } = this.#config.save;

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
   * @param {object} [options] Options for the search, which define a union of
   *   items to find.
   * @param {boolean} [options.current] Find the current (unmodified name) log
   *   file?
   * @param {boolean} [options.today] Find files with today's date (UTC)?
   * @param {boolean} [options.pastDays] Find files from previous days (UTC)?
   * @param {?string} [options.dateStr] Find files infixed with the given date
   *   string?
   * @returns {object[]} Array of useful information about each matched file.
   */
  async #findFiles(options = {}) {
    const {
      current  = false,
      today    = false,
      pastDays = false,
      dateStr  = null
    } = options;

    const { directory, filePrefix, fileSuffix } = this.#config.pathParts;
    const todayStr = BaseFilePreserver.#makeInfix(new Date());
    const contents = await fs.readdir(directory);
    const result   = [];

    for (const name of contents) {
      const parsed = BaseFilePreserver.#parseInfix(name, filePrefix, fileSuffix);
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
   * Produces a modified `path` by infixing the final path component with the
   * given value.
   *
   * @param {string} infix String to infix into the final path component.
   * @returns {string} The so-modified path.
   */
  #infixPath(infix) {
    const split = this.#config.pathParts;
    return `${split.directory}/${split.filePrefix}${infix}${split.fileSuffix}`;
  }

  /**
   * Preserves the file and does any other related actions, as configured.
   */
  async #preserve() {
    const origPath = this.#config.path;
    let   stats;

    try {
      stats = await Statter.statOrNull(origPath);
      if (!stats) {
        return;
      }
    } catch (e) {
      this.#logger?.errorWithStat(e);
      return;
    }

    try {
      const targetPath = await this.#targetPath(stats);
      await fs.rename(origPath, targetPath);
      this.#logger?.renamedTo(targetPath);
    } catch (e) {
      this.#logger?.errorWithRename(e);
    }

    await this.#deleteOldFiles();
  }

  /**
   * Main function of the threadlet for this instance.
   */
  async #run() {
    while (!this.#runner.shouldStop()) {
      await this._impl_doWork();

      if (this.#saveNow.value === true) {
        await this.#preserve();
        this.#saveNow.value = false;
      }

      const subclassPromise = this._impl_whenWorkRequired();
      const racers = [
        this.#saveNow.whenTrue(),
        ...(subclassPromise ? [subclassPromise] : [])
      ];

      await this.#runner.raceWhenStopRequested(racers);
    }

    // Give the subclass one last opportunity to request a save.
    await this._impl_doWork();
    if (this.#saveNow.value === true) {
      await this.#preserve();
      this.#saveNow.value = false;
    }
  }

  /**
   * Figures out the target (post-preservation) file name/path. It is based on
   * the creation date of the original, with an infix included in case of
   * contention.
   *
   * @param {fs.Stats} stats Result of `fs.stat()` on the original file path.
   * @returns {string} The post-preservation path.
   */
  async #targetPath(stats) {
    const dateStr = BaseFilePreserver.#makeInfix(stats.birthtime);
    const resolve = (count) => {
      const infix = BaseFilePreserver.#makeInfix(dateStr, (count > 0) ? count : null);
      return this.#infixPath(`-${infix}`);
    };

    if (this.#lastInfix === dateStr) {
      // Optimistically assume that if we've already picked a previous file name
      // with the given date that the next one in sequence will work. If that
      // turns out to be wrong, we'll fall back to the more involved code.
      const count    = this.#lastInfixCount + 1;
      const firstTry = resolve(count);
      if (!await Statter.fileExists(firstTry)) {
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
   * Gets a date string with optional count to use as an "infix" for a preserved
   * file.
   *
   * @param {Date|string} date Date to derive the (UTC) date label for the file,
   *   or an already-derived date string.
   * @param {?count} [count] Count to include in the result, or `null` to
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
