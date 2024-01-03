// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import * as timers from 'node:timers/promises';

import { FileServiceConfig } from '@this/app-config';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

import { BaseFilePreserver } from '#p/BaseFilePreserver';


/**
 * Configurable file "rotator" for doing log rotation and the like.
 */
export class Rotator extends BaseFilePreserver {
  /** @type {FileServiceConfig} Configuration to use. */
  #config;

  /**
   * @type {?number} How long to wait between checks, in msec, if timed checks
   * are to be done; or `null` not to do such checks.
   */
  #checkMsec;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration to use.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#config = MustBe.instanceOf(config, FileServiceConfig);

    this.#checkMsec = (config.rotate.checkSecs === null)
      ? null
      : config.rotate.checkSecs * 1000;
  }

  /** @override */
  async _impl_doWork() {
    // If this instance is configured for timed checks, then this is where the
    // checking is done. Otherwise, this method doesn't need to do anything.

    if (!this.#checkMsec) {
      // Not configured to do timed checks.
      return;
    }

    try {
      const stats = await fs.stat(this.#config.path);
      if (stats.size >= this.#config.rotate.atSize) {
        this._prot_saveNow();
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        this.logger?.errorWithStat(e);
      }
    }
  }

  /** @override */
  _impl_whenWorkRequired() {
    // If this instance is configured for timed checks, then this is where the
    // salient timeout is set up. Otherwise, this method doesn't need to do
    // anything.

    return this.#checkMsec
      ? timers.setTimeout(this.#checkMsec)
      : null;
  }
}
