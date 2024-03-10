// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { memoryUsage, pid as processPid, ppid as processPpid, uptime }
  from 'node:process';

import { WallClock } from '@this/clocks';
import { Duration, Moment } from '@this/data-values';
import { FormatUtils } from '@this/loggy';

import { ThisModule } from '#p/ThisModule';


/**
 * Utilities for getting at information about the process that is running this
 * system. This includes both fixed-at-startup-time info (such as the process
 * ID) _and_ live-updated info (such as the current amount of memory used).
 */
export class ProcessInfo {
  /**
   * @type {?Moment} The moment that the process started.
   *
   * **Note:** `process.uptime()` returns a number of seconds.
   */
  static #startedAt = new Moment(WallClock.now().atSec - uptime());

  /** @type {?object} All the fixed-at-startup info, if calculated. */
  static #fixedInfo = null;

  /** @returns {object} All process info, as a JSON-encodable object. */
  static get allInfo() {
    this.#makeFixedInfo();

    return {
      ...this.#fixedInfo,
      ...this.ephemeralInfo
    };
  }

  /**
   * @returns {object} Process info which varies over time, as a JSON-encodable
   * object.
   */
  static get ephemeralInfo() {
    const memoryInfo = memoryUsage();
    for (const [key, value] of Object.entries(memoryInfo)) {
      memoryInfo[key] = FormatUtils.byteCountString(value);
    }

    const uptimeInfo = this.uptime.toPlainObject();

    return { memoryUsage: memoryInfo, uptime: uptimeInfo };
  }

  /** @returns {Moment} The moment that the process started. */
  static get startedAt() {
    return this.#startedAt;
  }

  /** @returns {Duration} The process uptime. */
  static get uptime() {
    return WallClock.now().subtract(this.#startedAt);
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

    this.#fixedInfo = {
      pid:       processPid,
      ppid:      processPpid,
      startedAt: this.#startedAt.toPlainObject()
    };

    ThisModule.logger?.processInfo(this.#fixedInfo);
  }
}
