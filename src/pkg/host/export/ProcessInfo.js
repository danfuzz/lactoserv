// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import { FormatUtils } from '@this/loggy';


/**
 * Utilities for getting at information about the process that is running this
 * system.
 */
export class ProcessInfo {
  /** @type {?object} All the info, if calculated. */
  static #info = null;

  /** @returns {object} All process info. */
  static get allInfo() {
    this.#makeInfo();
    return { ...this.#info };
  }

  /**
   * Initializes this class.
   */
  static init() {
    this.#makeInfo();
  }

  /**
   * Makes {@link #info} if not yet done.
   */
  static #makeInfo() {
    if (this.#info) {
      return;
    }

    const startTimeMsec = Date.now() - (process.uptime() * 1000);
    const startTimeSecs = startTimeMsec / 1000;
    const startTime     = FormatUtils.dateTimeStringFromSecs(startTimeSecs);

    const pid  = process.pid;
    const ppid = process.ppid;

    this.#info = { pid, ppid, startTime, startTimeSecs };
  }
}
