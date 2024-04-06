// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { memoryUsage } from 'node:process';

import { Threadlet } from '@this/async';
import { WallClock } from '@this/clocks';
import { Duration, Moment } from '@this/data-values';
import { Host } from '@this/host';
import { MustBe } from '@this/typey';
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
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

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

    const { maxHeapBytes, maxRssBytes } = this.config;

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
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseService.Config {
    /**
     * How often to check, in seconds.
     *
     * @type {Duration}
     */
    #checkPeriod;

    /**
     * Grace period before triggering an action.
     *
     * @type {Duration}
     */
    #gracePeriod;

    /**
     * Maximum allowed size of heap usage, in bytes, or `null` for no limit.
     *
     * @type {?number}
     */
    #maxHeapBytes;

    /**
     * Maximum allowed size of RSS, in bytes, or `null` for no limit.
     *
     * @type {?number}
     */
    #maxRssBytes;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        checkPeriod  = null,
        gracePeriod  = null,
        maxHeapBytes = null,
        maxRssBytes  = null
      } = rawConfig;

      this.#checkPeriod = Duration.parse(checkPeriod ?? '5 min', { minInclusive: 1 });
      if (!this.#checkPeriod) {
        throw new Error(`Could not parse \`checkPeriod\`: ${checkPeriod}`);
      }

      this.#gracePeriod = Duration.parse(gracePeriod ?? '0 sec', { minInclusive: 0 });
      if (!this.#gracePeriod) {
        throw new Error(`Could not parse \`gracePeriod\`: ${gracePeriod}`);
      }

      this.#maxHeapBytes = (maxHeapBytes === null)
        ? null
        : MustBe.number(maxHeapBytes, { finite: true, minInclusive: 1024 * 1024 });

      this.#maxRssBytes = (maxRssBytes === null)
        ? null
        : MustBe.number(maxRssBytes, { finite: true, minInclusive: 1024 * 1024 });
    }

    /** @returns {Duration} How often to check. */
    get checkPeriod() {
      return this.#checkPeriod;
    }

    /** @returns {Duration} Grace period before triggering an action. */
    get gracePeriod() {
      return this.#gracePeriod;
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
