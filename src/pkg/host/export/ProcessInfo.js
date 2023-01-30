// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { FormatUtils } from '@this/loggy';

import { ThisModule } from '#p/ThisModule';


/**
 * Utilities for getting at information about the process that is running this
 * system. This includes both fixed-at-startup-time info (such as the process
 * ID) _and_ live-updated info (such as the current amount of memory used).
 */
export class ProcessInfo {
  /** @type {?object} All the fixed-at-startup info, if calculated. */
  static #fixedInfo = null;

  /** @returns {object} All process info. */
  static get allInfo() {
    this.#makeFixedInfo();

    const memoryUsage = process.memoryUsage();
    for (const [key, value] of Object.entries(memoryUsage)) {
      memoryUsage[key] = FormatUtils.byteCountString(value);
    }

    const result = {
      ...this.#fixedInfo,
      memoryUsage
    };

    return result;
  }

  /**
   * Initializes this class.
   */
  static init() {
    this.#makeFixedInfo();
  }

  /**
   * Makes {@link #info} if not yet done.
   */
  static #makeFixedInfo() {
    if (this.#fixedInfo) {
      return;
    }

    const startSecs = (Date.now() - (process.uptime() * 1000)) / 1000;
    const pid       = process.pid;
    const ppid      = process.ppid;

    this.#fixedInfo = {
      pid,
      ppid,
      startedAt: FormatUtils.compoundDateTimeFromSecs(startSecs)
    };

    ThisModule.logger.processInfo(this.#fixedInfo);
  }
}
