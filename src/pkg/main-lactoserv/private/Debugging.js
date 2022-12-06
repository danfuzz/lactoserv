// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { Host } from '@this/host';
import { Loggy } from '@this/loggy';

import { MainArgs } from '#p/MainArgs';
import { UsualSystem } from '#p/UsualSystem';


/**
 * Utilities for debugging support.
 */
export class Debugging {
  /**
   * Processes the debugging-related arguments / options, if any.
   *
   * @param {object} args Parsed command-line debugging arguments.
   * @param {UsualSystem} system The system to be run.
   */
  static handleDebugArgs(args, system) {
    const { logToStdout, maxRunTimeSecs } = args;

    if (logToStdout) {
      this.#logToStdout();
    }

    if (maxRunTimeSecs) {
      this.#setMaxRunTimeSecs(maxRunTimeSecs);
    }
  }

  /**
   * Sets up logging to `stdout`.
   */
  static #logToStdout() {
    Host.logToStdout();
  }

  /**
   * Sets the maximum run time.
   *
   * @param {number} maxRunTimeSecs The maximum run time.
   */
  static #setMaxRunTimeSecs(maxRunTimeSecs) {
    const logger = Loggy.loggerFor('main').debug;

    (async () => {
      logger.timerStarted({ seconds: maxRunTimeSecs });

      let remainingSecs = maxRunTimeSecs;
      if (maxRunTimeSecs > 60) {
        await timers.setTimeout((maxRunTimeSecs - 60) * 1000);
        remainingSecs = 60;
      }

      let warningFreqSecs = 10;
      let extraSecs       = remainingSecs % warningFreqSecs;

      while (remainingSecs > 0) {
        logger.timeRemaining({ seconds: remainingSecs });

        const secs = extraSecs + warningFreqSecs;
        await timers.setTimeout(secs * 1000);
        remainingSecs -= secs;
        extraSecs = 0;

        if (remainingSecs <= 5) {
          warningFreqSecs = 1;
        } else if (remainingSecs <= 10) {
          warningFreqSecs = 5;
        }
      }

      logger.timerExpired({ seconds: maxRunTimeSecs });
      await system.stop();
    })();
  }
}
