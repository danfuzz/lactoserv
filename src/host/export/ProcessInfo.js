// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WallClock } from '@this/clocks';
import { Moment } from '@this/data-values';
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

    return {
      ...this.#fixedInfo,
      ...this.ephemeralInfo
    };
  }

  /** @returns {object} Process info which varies over time. */
  static get ephemeralInfo() {
    const memoryUsage = process.memoryUsage();
    for (const [key, value] of Object.entries(memoryUsage)) {
      memoryUsage[key] = FormatUtils.byteCountString(value);
    }

    return { memoryUsage };
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

    // Note: `process.uptime()` returns a number of seconds.
    const startedAtSec = WallClock.now().atSec - process.uptime();
    const pid          = process.pid;
    const ppid         = process.ppid;

    this.#fixedInfo = {
      pid,
      ppid,
      startedAt: Moment.plainObjectFromSec(startedAtSec)
    };

    ThisModule.logger?.processInfo(this.#fixedInfo);
  }
}
