// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ServiceConfig } from '@this/app-config';
import { BaseService } from '@this/app-framework';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Service which monitors the system's memory usage and can initiate shutdown
 * before a memory problem becomes dire. Configuration object details:
 *
 * * `{?number} checkSecs` -- How often to check things, in seconds, or `null`
 *   to use a default frequency. Defaults to `60` (once per minute).
 * * `{?number} gracePeriodSecs` -- Once the maximum size has been reached, how
 *   long it must remain at or beyond the maximum before this service takes
 *   action, or `null` not to have a grace period at all (equivalent to `0`).
 *   When in the middle of a grace period, the system checks more often than
 *   `checkSecs` so as not to miss a significant dip. Defaults to `null`.
 * * `{?number} maxHeapBytes` -- How large to allow the heap to get before
 *   initiating shutdown, or `null` for no limit on this. Defaults to `null`.
 *   The amount counted is `heapTotal + external` from `process.memoryUsage()`.
 * * `{?number} maxRssBytes` -- How large to allow the RSS to get before
 *   initiating shutdown, or `null` for no limit on this. Defaults to `null`.
 */
export class MemoryMonitor extends BaseService {
  // TODO

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    // TODO
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // TODO
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // TODO
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ServiceConfig {
    /** @type {number} How often to check, in seconds. */
    #checkSecs;

    /** @type {number} Grace period before triggering an action, in seconds. */
    #gracePeriodSecs;

    /**
     * @type {?number} Maximum allowed size of heap usage, in bytes, or `null`
     * for no limit.
     */
    #maxHeapBytes;

    /**
     * @type {?number} Maximum allowed size of RSS, in bytes, or `null` for no
     * limit.
     */
    #maxRssBytes;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      // TODO
    }

    /** @returns {number} How often to check, in seconds. */
    get checkSecs() {
      return this.#checkSecs;
    }

    /**
     * @returns {number} Grace period before triggering an action, in seconds.
     */
    get gracePeriodSecs() {
      return this.#gracePeriodSecs;
    }

    /**
     * @returns {?number} Maximum allowed size of heap usage, in bytes, or
     * `null` for no limit.
     */
    get maxHeapBytes() {
      return this.#maxHeapBytes;
    }

    /**
     * @returns {?number} Maximum allowed size of RSS, in bytes, or `null` for
     * no limit.
     */
    get maxRssBytes() {
      return this.#maxRssBytes;
    }
  };
}
