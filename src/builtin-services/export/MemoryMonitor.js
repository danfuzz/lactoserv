// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { memoryUsage } from 'node:process';
import { setTimeout } from 'node:timers/promises';

import { ServiceConfig } from '@this/sys-config';
import { BaseService } from '@this/app-framework';
import { Threadlet } from '@this/async';
import { Moment } from '@this/data-values';
import { Host } from '@this/host';
import { MustBe } from '@this/typey';


/**
 * Service which monitors the system's memory usage and can initiate shutdown
 * before a memory problem becomes dire. Configuration object details:
 *
 * * `{?number} checkSecs` -- How often to check things, in seconds, or `null`
 *   to use the default frequency. Minimum `1`. Defaults to `60` (once per
 *   minute).
 * * `{?number} gracePeriodSecs` -- Once a memory limit has been reached, how
 *   long it is allowed to remain at or beyond the maximum before this service
 *   takes action, or `null` not to have a grace period at all (equivalent to
 *   `0`). When in the middle of a grace period, the system checks more often
 *   than `checkSecs` so as not to miss a significant dip. Defaults to `null`.
 * * `{?number} maxHeapBytes` -- How many bytes of heap is considered "over
 *   limit," or `null` for no limit on this. The amount counted is `heapTotal +
 *   external` from `process.memoryUsage()`. Defaults to `null`. **Note:** In
 *   order to catch probably-unintentional misconfiguration, if a number, must
 *   be at least one megabyte.
 *   The amount counted is `heapTotal + external` from `process.memoryUsage()`.
 * * `{?number} maxRssBytes` -- How many bytes of RSS is considered "over
 *   limit," or `null` for no limit on this. Defaults to `null`. **Note:** In
 *   order to catch probably-unintentional misconfiguration, if non-`null`, must
 *   be at least one megabyte.
 */
export class MemoryMonitor extends BaseService {
  /** @type {Threadlet} Threadlet which runs this service. */
  #runner = new Threadlet(() => this.#run());

  /**
   * @type {?{ heap: number, rss: number, troubleAtMsec: ?number }} Last memory
   * snapshot (including trouble indicator), if any.
   */
  #lastSnapshot = null;

  // Note: Default constructor is fine for this class.

  /** @override */
  async _impl_start(isReload_unused) {
    await this.#runner.start();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.#runner.stop();
  }

  /**
   * Takes a memory snapshot, including figuring out if we're in an "over limit"
   * situation or not.
   *
   * @returns {object} The current snapshot.
   */
  #takeSnapshot() {
    const rawUsage = memoryUsage();
    const now      = Moment.fromMsec(Date.now());

    // Note: Per Node docs, `external` includes the `arrayBuffers` value in it.
    const usage = {
      heap: rawUsage.heapUsed + rawUsage.external,
      rss:  rawUsage.rss
    };

    this.logger?.usage(usage);

    const snapshot = {
      ...usage,
      at:        now,
      troubleAt: this.#lastSnapshot?.troubleAt ?? null,
      actionAt:  this.#lastSnapshot?.actionAt ?? null
    };

    const { maxHeapBytes, maxRssBytes } = this.config;

    if (   (maxHeapBytes && (snapshot.heap >= maxHeapBytes))
        || (maxRssBytes  && (snapshot.rss  >= maxRssBytes))) {
      if (!snapshot.troubleAt) {
        // We just transitioned to an "over limit" situation.
        const actionAt = now.addSecs(this.config.gracePeriodSecs);
        snapshot.troubleAt = now;
        snapshot.actionAt  = actionAt;
        this.logger?.overLimit({ actionAt });
      }
    } else {
      if (snapshot.troubleAt) {
        // We just transitioned back to a "within limit" situation.
        snapshot.troubleAt = null;
        snapshot.actionAt  = null;
        this.logger?.withinLimit();
      }
    }

    this.#lastSnapshot = snapshot;
    return snapshot;
  }

  /**
   * Runs the service thread.
   */
  async #run() {
    const checkMsec = this.config.checkSecs * 1000;

    while (!this.#runner.shouldStop()) {
      const snapshot = this.#takeSnapshot();

      if (snapshot.actionAt && (snapshot.actionAt.atSecs < snapshot.at.atSecs)) {
        this.logger?.takingAction();
        // No `await`, because then the shutdown handler would end up deadlocked
        // with the stopping of this threadlet.
        Host.exit(1);
        break;
      }

      let timeoutMsec = checkMsec;
      if (snapshot.actionAt) {
        const msecUntilAction = snapshot.actionAt.subtract(snapshot.at).secs * 1000;
        const msecUntilCheck  = Math.min(
          checkMsec,
          Math.max(
            msecUntilAction * MemoryMonitor.#TROUBLE_CHECK_FRACTION,
            MemoryMonitor.#MIN_TROUBLE_CHECK_MSEC));
        timeoutMsec = msecUntilCheck;
      }

      await this.#runner.raceWhenStopRequested([
        setTimeout(timeoutMsec)
      ]);
    }
  }


  //
  // Static members
  //

  /**
   * @type {number} Minimum amount of time in msec between checks, when dealing
   * with an "over limit" situation.
   */
  static #MIN_TROUBLE_CHECK_MSEC = 1000;

  /**
   * @type {number} Fraction of time between "now" and when action needs to
   * happen, when the next check should take place in an "over limit" situation.
   */
  static #TROUBLE_CHECK_FRACTION = 0.4;

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

      const {
        checkSecs       = null,
        gracePeriodSecs = null,
        maxHeapBytes    = null,
        maxRssBytes     = null
      } = config;

      this.#checkSecs = (checkSecs === null)
        ? 5 * 60
        : MustBe.number(checkSecs, { finite: true, minInclusive: 1 });
      this.#gracePeriodSecs = (gracePeriodSecs === null)
        ? 0
        : MustBe.number(gracePeriodSecs, { finite: true, minInclusive: 0 });
      this.#maxHeapBytes = (maxHeapBytes === null)
        ? null
        : MustBe.number(maxHeapBytes, { finite: true, minInclusive: 1024 * 1024 });
      this.#maxRssBytes = (maxRssBytes === null)
        ? null
        : MustBe.number(maxRssBytes, { finite: true, minInclusive: 1024 * 1024 });
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
