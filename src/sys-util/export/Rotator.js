// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WallClock } from '@this/clocks';
import { Duration } from '@this/data-values';
import { Statter } from '@this/fs-util';
import { IntfLogger } from '@this/loggy-intf';
import { FileServiceConfig } from '@this/sys-config';
import { MustBe } from '@this/typey';

import { BaseFilePreserver } from '#p/BaseFilePreserver';


/**
 * Configurable file "rotator" for doing log rotation and the like.
 */
export class Rotator extends BaseFilePreserver {
  /**
   * Configuration to use.
   *
   * @type {FileServiceConfig}
   */
  #config;

  /**
   * How long to wait between checks if timed checks are to be
   * done, or `null` not to do such checks.
   *
   * @type {?Duration}
   */
  #checkPeriod;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration to use.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#config      = MustBe.instanceOf(config, FileServiceConfig);
    this.#checkPeriod = config.rotate.checkPeriod;
  }

  /** @override */
  async _impl_doWork() {
    // If this instance is configured for timed checks, then this is where the
    // checking is done. Otherwise, this method doesn't need to do anything.

    if (!this.#checkPeriod) {
      // Not configured to do timed checks.
      return;
    }

    try {
      const stats = await Statter.statOrNull(this.#config.path);
      if (stats && (stats.size >= this.#config.rotate.atSize)) {
        this._prot_saveNow();
      }
    } catch (e) {
      this.logger?.errorWithStat(e);
    }
  }

  /** @override */
  _impl_whenWorkRequired() {
    // If this instance is configured for timed checks, then this is where the
    // salient timeout is set up. Otherwise, this method doesn't need to do
    // anything.

    return this.#checkPeriod
      ? WallClock.waitForMsec(this.#checkPeriod.msec)
      : null;
  }
}
