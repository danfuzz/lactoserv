// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { memoryUsage } from 'node:process';

import { Threadlet } from '@this/async';
import { WallClock } from '@this/clocky';
import { ByteCount, Duration, Moment } from '@this/data-values';
import { Host } from '@this/host';
import { BaseService } from '@this/webapp-core';


/**
 * Service which monitors the system's memory usage and can initiate shutdown
 * before a memory problem becomes dire.
 *
 * See `doc/configuration` for configuration object details.
 */
export class MemoryMonitor extends BaseService {
  /**
   * Threadlet which runs this service.
   *
   * @type {Threadlet}
   */
  #runner = new Threadlet((ra) => this.#run(ra));

  /**
   * Most recent memory snapshot (along with timing info), or `null` if a
   * snapshot has not yet been taken.
   *
   * @type {?{ heap: number, rss: number, at: Moment, troubleAt: ?Duration,
   * actionAt: ?Moment }}
   */
  #lastSnapshot = null;

  // @defaultConstructor

  /** @override */
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
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
    const now      = WallClock.now();

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

    const { maxHeap, maxRss } = this.config;
    const maxHeapBytes        = maxHeap?.byte;
    const maxRssBytes         = maxRss?.byte;

    if (   (maxHeapBytes && (snapshot.heap >= maxHeapBytes))
        || (maxRssBytes  && (snapshot.rss  >= maxRssBytes))) {
      if (!snapshot.troubleAt) {
        // We just transitioned to an "over limit" situation.
        const actionAt = now.add(this.config.gracePeriod);
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
   *
   * @param {Threadlet.RunnerAccess} runnerAccess Thread runner access object.
   */
  async #run(runnerAccess) {
    const checkMsec = this.config.checkPeriod.msec;

    while (!runnerAccess.shouldStop()) {
      const snapshot = this.#takeSnapshot();

      if (snapshot.actionAt && (snapshot.actionAt.atSec < snapshot.at.atSec)) {
        this.logger?.takingAction();
        // No `await`, because then the shutdown handler would end up deadlocked
        // with the stopping of this threadlet.
        Host.exit(1);
        break;
      }

      let timeoutMsec = checkMsec;
      if (snapshot.actionAt) {
        const msecUntilAction =
          snapshot.actionAt.subtract(snapshot.at).sec * 1000;
        const msecUntilCheck = Math.min(
          checkMsec,
          Math.max(
            msecUntilAction * MemoryMonitor.#TROUBLE_CHECK_FRACTION,
            MemoryMonitor.#MIN_TROUBLE_CHECK_MSEC));

        timeoutMsec = msecUntilCheck;
      }

      await runnerAccess.raceWhenStopRequested([
        WallClock.waitForMsec(timeoutMsec)
      ]);
    }
  }


  //
  // Static members
  //

  /**
   * Minimum amount of time in msec between checks, when dealing with an "over
   * limit" situation.
   *
   * @type {number}
   */
  static #MIN_TROUBLE_CHECK_MSEC = 1000;

  /**
   * Fraction of time between "now" and when action needs to happen, when the
   * next check should take place in an "over limit" situation.
   *
   * @type {number}
   */
  static #TROUBLE_CHECK_FRACTION = 0.4;

  /** @override */
  static _impl_configClass() {
    return class Config extends BaseService.Config {
      // @defaultConstructor

      /**
       * How often to check, in seconds. If passed as a string, it is parsed by
       * {@link Duration#parse}.
       *
       * @param {string|Duration} [value] Proposed configuration value. Default
       *   `5 min`.
       * @returns {Duration} Accepted configuration value.
       */
      _config_checkPeriod(value = '5 min') {
        const result = Duration.parse(value, { range: { minInclusive: 1 } });

        if (!result) {
          throw new Error(`Could not parse \`checkPeriod\`: ${value}`);
        }

        return result;
      }

      /**
       * Grace period before triggering an action. If passed as a string, it is
       * parsed by {@link Duration#parse}.
       *
       * @param {string|Duration} [value] Proposed configuration value. Default
       *   `0 sec` (that is, no grace period).
       * @returns {Duration} Accepted configuration value.
       */
      _config_gracePeriod(value = '0 sec') {
        const result = Duration.parse(value, { range: { minInclusive: 0 } });

        if (!result) {
          throw new Error(`Could not parse \`gracePeriod\`: ${value}`);
        }

        return result;
      }

      /**
       * Maximum allowed size of heap usage, or `null` for no limit. If passed
       * as a string, it is parsed by {@link ByteCount#parse}.
       *
       * @param {?string|ByteCount} [value] Proposed configuration value.
       *   Default `null`.
       * @returns {?ByteCount} Accepted configuration value.
       */
      _config_maxHeap(value = null) {
        if (value === null) {
          return null;
        }

        const result = ByteCount.parse(value, { minInclusive: 1024 * 1024 });

        if (!result) {
          throw new Error(`Could not parse \`maxHeap\`: ${value}`);
        }

        return result;
      }

      /**
       * Maximum allowed size of RSS, or `null` for no limit. If passed as a
       * string, it is parsed by {@link ByteCount#parse}.
       *
       * @param {?string|ByteCount} [value] Proposed configuration value.
       *   Default `null`.
       * @returns {?ByteCount} Accepted configuration value.
       */
      _config_maxRss(value = null) {
        if (value === null) {
          return null;
        }

        const result = ByteCount.parse(value, { minInclusive: 1024 * 1024 });

        if (!result) {
          throw new Error(`Could not parse \`maxRss\`: ${value}`);
        }

        return result;
      }
    };
  }
}
